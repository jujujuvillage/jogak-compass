// POST /api/chat { question, product?, history? } → 문서 근거 기반 답변
import { fetchDocumentSections } from '@/lib/dart';
import { sectionsForQuestion, sectionsToPrompt } from '@/lib/docparse';
import { errorResponse, json } from '@/lib/http';
import { chatText } from '@/lib/openai';
import { clientIp, envInt, rateLimit } from '@/lib/store';
import type { ChatMessage, Product } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `당신은 "조각나침반 에이전트"예요. 조각투자 입문자가 상품 구조를 이해하도록 돕는 설명 도우미예요.
규칙:
- 쉬운 해요체 한국어로 4~7문장 안에 답해요. 목록이 도움이 되면 짧은 줄바꿈 목록을 써도 돼요.
- 상품 문서가 주어지면 그 내용만 근거로 답하고, 근거가 된 부분은 문장 끝에 [근거: 섹션 제목] 형태로 표시해요.
- 문서로 확인되는 사실과 문서에 없어 알 수 없는 것을 구분해서 말해요. 모르는 건 "문서에서 확인 불가"라고 해요.
- 매수·매도·보유를 권하지 않고, 수익을 전망하거나 보장하지 않아요. "사도 될까요?" 같은 질문에는 판단은 본인 몫이라고 말하고, 대신 확인할 조건(기간, 회수 방법, 수수료, 위험)을 짚어 줘요.
- 숫자 계산이 필요하면 직접 계산하지 말고 앱의 '실수익 계산기'를 쓰라고 안내해요.
- 조각투자와 관계없는 요청에는 정중히 조각투자 질문을 부탁해요.`;

function productBrief(p: Product): string {
  const n = p.numbers;
  const v = (x: { value: number | null }) => (x.value === null ? '확인 불가' : String(x.value));
  return [
    `상품명: ${p.name} (${p.assetType}, 발행사 ${p.issuer})${p.source === 'sample' ? ' — 가상 예시 상품' : ''}`,
    `한 줄 요약: ${p.oneLine}`,
    `돈 버는 방식: ${p.howToEarn.value}`,
    `묶이는 기간: ${p.lockup.value}`,
    `돌려받는 방법: ${p.howToExit.value}`,
    `수수료: ${p.fees.value}`,
    `분배: ${p.distribution.value}`,
    `중도 매도: ${p.secondaryMarket}`,
    `숫자: 1증권 ${v(n.pricePerUnit)}원, 보유 ${v(n.holdingMonthsMin)}~${v(n.holdingMonthsMax)}개월, 매수수수료 ${v(n.buyFeePct)}%, 매각수수료 ${v(n.sellFeePct)}%, 연보수 ${v(n.annualFeePct)}%, 성과보수 ${v(n.successFeePct)}%`,
    `주요 위험: ${p.risks.map((r) => r.title).join(', ')}`,
  ].join('\n');
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { question?: unknown; product?: Product | null; history?: ChatMessage[] };
    const question = typeof body.question === 'string' ? body.question.trim().slice(0, 500) : '';
    if (!question) return json({ error: '질문을 입력해 주세요.' }, 400);

    const rl = await rateLimit(`chat:${clientIp(req)}`, envInt('RATE_LIMIT_CHAT_PER_HOUR', 40), 3600);
    if (!rl.ok) return json({ error: '질문이 많아 잠시 쉬어 갈게요. 조금 뒤에 다시 물어봐 주세요.' }, 429);

    const p = body.product && typeof body.product === 'object' ? body.product : null;
    let context = '선택된 상품이 없어요. 조각투자 일반에 대해 답하고, 특정 상품 질문이면 상품을 먼저 선택하도록 안내해요.';
    if (p) {
      context = `[상품 요약 — 앱이 문서에서 정리한 내용]\n${productBrief(p)}`;
      const rcept = p.dart?.rceptNo;
      if (p.source === 'dart' && rcept && /^\d{14}$/.test(rcept)) {
        try {
          const sections = await fetchDocumentSections(rcept);
          context += `\n\n[증권신고서 원문 발췌 — "${p.dart?.reportName}"]\n${sectionsToPrompt(sectionsForQuestion(sections, question))}`;
        } catch (e) {
          console.error('doc fetch for chat failed', e);
          context += '\n\n(원문을 불러오지 못해 요약만으로 답해요. 그렇다고 알려 주세요.)';
        }
      } else if (p.source === 'sample') {
        context += '\n\n이 상품은 화면 시연용 가상 예시라 실제 문서가 없어요. 답할 때 가상 예시임을 밝혀요.';
      }
    }

    const history = (Array.isArray(body.history) ? body.history : [])
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));

    const answer = await chatText([
      { role: 'system', content: `${SYSTEM}\n\n${context}` },
      ...history,
      { role: 'user', content: question },
    ]);
    return json({ answer });
  } catch (e) {
    return errorResponse(e);
  }
}
