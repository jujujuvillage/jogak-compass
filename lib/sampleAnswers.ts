// 미리 정해진 질문(칩·버튼)에 대한 샘플 답변. AI를 호출하지 않고, 선택한 상품의 정리된 정보로 문장을 만든다.
import type { Product } from './types';
import { monthsLabel, pct } from './calc';

export const PRESET_QUESTIONS = ['투자금은 언제 돌려받아요?', '수수료는 어떤 게 있어요?', '가장 큰 위험이 뭐예요?', '중간에 팔 수 있어요?'];

type Kind = 'exit' | 'fee' | 'risk' | 'market' | 'disclosure';

function kindOf(q: string): Kind {
  if (/수수료|비용|보수/.test(q)) return 'fee';
  if (/위험|리스크/.test(q)) return 'risk';
  if (/중간에|팔 수|매도|유통/.test(q)) return 'market';
  if (/공시/.test(q)) return 'disclosure';
  return 'exit';
}

const ev = (section?: string) => (section ? ` [근거: ${section}]` : '');

function forProduct(kind: Kind, p: Product): string {
  const n = p.numbers;
  const sampleNote = p.source === 'sample' ? '\n\n※ 가상 예시 상품의 조건이에요.' : '';
  switch (kind) {
    case 'exit':
      return (
        `${p.name}은(는) ${p.howToExit.found ? p.howToExit.value : '돌려받는 방법이 문서에서 확인되지 않았어요.'}${ev(p.howToExit.evidence?.section)}\n` +
        `예상 보유 기간은 ${monthsLabel(n.holdingMonthsMin.value, n.holdingMonthsMax.value)}이에요. ${p.lockup.found ? p.lockup.value : ''}${ev(p.lockup.evidence?.section)}\n` +
        `${p.regularDistribution === false ? '보유하는 동안 정기 분배는 없고, 자산을 판 뒤 한 번에 정산해요.' : p.regularDistribution === true ? '보유하는 동안에도 분배금이 나올 수 있지만 금액은 변동돼요.' : '정기 분배 여부는 문서에서 확인 불가예요.'}\n` +
        `매각이 늦어지면 돌려받는 시점도 늦어질 수 있어요.${sampleNote}`
      );
    case 'fee': {
      const parts = [
        n.buyFeePct.value !== null ? `매수 ${pct(n.buyFeePct.value, 2)}` : null,
        n.sellFeePct.value !== null ? `매각 ${pct(n.sellFeePct.value, 2)}` : null,
        n.annualFeePct.value !== null ? `연 보수 ${pct(n.annualFeePct.value, 2)}` : null,
        n.successFeePct.value !== null && n.successFeePct.value > 0 ? `성과보수 이익의 ${pct(n.successFeePct.value)}` : null,
      ].filter(Boolean);
      return (
        `${p.name}의 수수료는 ${parts.length ? parts.join(', ') : '문서에서 확인 불가'}예요.${ev(p.fees.evidence?.section)}\n` +
        `${p.fees.found ? p.fees.value : ''}\n` +
        `보유 기간 전체로 따지면 얼마인지는 상품 상세의 '실수익 계산기'나 '비교' 탭의 총비용에서 확인할 수 있어요.${sampleNote}`
      );
    }
    case 'risk':
      return p.risks.length
        ? `${p.name}에서 확인할 주요 위험이에요.\n` + p.risks.slice(0, 3).map((r, i) => `${i + 1}. ${r.title} — ${r.explanation}${ev(r.evidence?.section)}`).join('\n') + `\n원금은 보장되지 않아요.${sampleNote}`
        : `${p.name}의 주요 위험은 문서에서 확인 불가예요. 원문의 '투자위험요소' 부분을 꼭 읽어 보세요.${sampleNote}`;
    case 'market':
      return (
        (p.secondaryMarket === '가능'
          ? `${p.name}은(는) 만기 전에 다른 투자자에게 팔 수 있는 경로가 있어요.${ev(p.secondaryMarketEvidence?.section)} 다만 사려는 사람이 없으면 원하는 때, 원하는 가격에 팔지 못할 수 있어요.`
          : p.secondaryMarket === '불가'
            ? `${p.name}은(는) 중간에 팔기 어려운 구조예요.${ev(p.secondaryMarketEvidence?.section)} 자산이 팔리거나 사업이 끝날 때까지 돈이 묶인다고 생각하는 게 안전해요.`
            : `${p.name}의 중도 매도 가능 여부는 문서에서 확인 불가예요. 투자설명서의 '양도 제한'이나 '유통' 부분을 확인해 보세요.`) + sampleNote
      );
    case 'disclosure':
      return `발행사 공시에서는 이런 점을 먼저 보세요.\n1. 증권발행실적보고서: 실제로 얼마나 모였는지\n2. 정정 신고서: 수수료·기간 같은 조건이 바뀌었는지\n3. 운용·매각 관련 공시: 자산 매각 일정이나 비용 변화\n'내 자산' 화면의 공시 목록에서 원문을 열어 확인할 수 있어요.${sampleNote}`;
  }
}

const GENERIC: Record<Kind, string> = {
  exit: '조각투자는 상품마다 돌려받는 방식이 달라요.\n• 부동산: 보유 중 임대료 배당 + 만기에 건물 매각 후 정산\n• 미술품: 배당 없이 작품이 팔린 뒤 한 번에 정산(만기까지 안 팔릴 수도 있어요)\n• 한우: 20~26개월 사육 후 경매 매각 뒤 정산\n• 음원: 저작권료를 매월 분배, 정해진 만기 없음\n특정 상품이 궁금하면 위에서 상품을 선택해 주세요.',
  fee: '조각투자 수수료는 보통 네 가지로 나뉘어요.\n• 매수(청약) 수수료\n• 매년 빠지는 운용·보관·보험 보수\n• 매각할 때 빠지는 수수료\n• 이익이 났을 때 떼는 성과보수\n상품마다 붙는 항목이 달라서, 비교 탭의 "N년 보유 시 총비용"으로 같은 기준에서 비교하는 게 좋아요.',
  risk: '조각투자의 공통 위험이에요.\n1. 원금 손실: 자산 가치가 떨어지면 원금을 잃을 수 있어요.\n2. 환금성: 원할 때 팔지 못하거나 매각이 늦어질 수 있어요.\n3. 자산별 위험: 공실(부동산), 매각 지연(미술품), 질병·폐사(한우), 저작권료 감소(음원).\n특정 상품의 위험은 상품을 선택하고 다시 물어봐 주세요.',
  market: '투자계약증권은 아직 유통시장이 없는 경우가 많아서, 자산이 팔릴 때까지 중간에 돈을 빼기 어려운 상품이 많아요. 장외거래소가 열리면 달라질 수 있지만, 그때도 사려는 사람이 있어야 팔 수 있어요.\n상품을 선택하면 그 상품의 조건을 알려 드릴게요.',
  disclosure: '보유 상품의 공시는 "내 자산" 화면에서 발행사별로 모아 볼 수 있어요. 증권발행실적보고서, 정정 신고서, 운용·매각 관련 공시를 먼저 확인해 보세요.',
};

export function sampleAnswer(question: string, product: Product | null): string {
  const kind = kindOf(question);
  return product ? forProduct(kind, product) : GENERIC[kind];
}
