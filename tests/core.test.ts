import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import iconv from 'iconv-lite';
import { holdingCost, runScenario, minInvestment, monthsLabel } from '@/lib/calc';
import { checkFit } from '@/lib/fit';
import { normalize, parseDartZip, selectSections, verifyQuote, xmlToSections } from '@/lib/docparse';
import { SAMPLE_PRODUCTS } from '@/lib/samples';
import { DEFAULT_PROFILE } from '@/lib/client';
import type { Product } from '@/lib/types';

const art = SAMPLE_PRODUCTS.find((p) => p.id === 'sample-art1')!; // 매수0, 매각0, 연1.5, 성과20, 정기분배 없음
const bld = SAMPLE_PRODUCTS.find((p) => p.id === 'sample-building')!; // 매수0.2, 매각0.2, 연0.5

describe('calc', () => {
  it('N년 보유 시 총비용 = 매수 + 연보수×N + 매각', () => {
    const c = holdingCost(bld, 1_000_000, 2);
    expect(c.buyFee).toBe(2000);
    expect(c.annualFees).toBe(10000);
    expect(c.sellFee).toBe(2000);
    expect(c.total).toBe(14000);
    expect(c.totalPct).toBeCloseTo(1.4);
    expect(c.missing).toEqual([]);
  });

  it('미술품 낙관 시나리오: 보수·성과보수·세금 차감', () => {
    const r = runScenario(art, { amount: 1_000_000, years: 2, valueChangePct: 20, distributionYieldPct: 5, taxPct: 15.4, depositRatePct: 3 });
    // 정기 분배 없는 상품은 분배율을 넣어도 0
    expect(r.distributions).toBe(0);
    expect(r.saleValue).toBe(1_200_000);
    expect(r.annualFees).toBe(30000);
    // 매각 이익(성과보수 전) = 1,200,000 - 0 - 30,000 - 1,000,000 = 170,000 → 성과보수 20% = 34,000
    expect(r.successFee).toBe(34000);
    // 과세 대상 136,000 × 15.4% = 20,944
    expect(r.tax).toBe(20944);
    expect(r.netReceipt).toBe(1_200_000 - 30000 - 34000 - 20944);
    expect(r.netProfit).toBe(r.netReceipt - 1_000_000);
    // 예금: 1,000,000 × (1.03^2 - 1) = 60,900 → 세후 51,521
    expect(r.depositReceipt).toBe(1_051_521);
  });

  it('비관 시나리오는 성과보수·세금 0', () => {
    const r = runScenario(art, { amount: 1_000_000, years: 2, valueChangePct: -30, distributionYieldPct: 0, taxPct: 15.4, depositRatePct: 3 });
    expect(r.successFee).toBe(0);
    expect(r.tax).toBe(0);
    expect(r.netReceipt).toBe(700_000 - 30000);
  });

  it('문서에서 못 찾은 수수료는 missing으로 표시', () => {
    const p: Product = { ...bld, numbers: { ...bld.numbers, annualFeePct: { value: null, evidence: null } } };
    expect(holdingCost(p, 1_000_000, 1).missing).toContain('연간 보수');
  });

  it('보조 함수', () => {
    expect(minInvestment(bld)).toBe(5000);
    expect(monthsLabel(36, 60)).toBe('3년~5년');
    expect(monthsLabel(null, 24)).toBe('2년');
    expect(monthsLabel(null, null)).toBe('확인 불가');
  });
});

describe('fit', () => {
  it('1년 안에 돈이 필요하고 중도 인출 가능성 → 미술품은 어긋남', () => {
    const items = checkFit(art, { ...DEFAULT_PROFILE, needMoneyInMonths: 12, mayNeedEarlyExit: true, purpose: '정기수익' });
    const mism = items.filter((i) => i.level === 'mismatch').map((i) => i.title);
    expect(mism).toEqual(expect.arrayContaining(['돈이 묶이는 기간', '중간에 돈 빼기', '정기적인 수익', '원금 손실']));
  });
  it('5년 여유 + 손실 감수 → 기간은 일치', () => {
    const items = checkFit(art, { ...DEFAULT_PROFILE, needMoneyInMonths: 60, mayNeedEarlyExit: false, canAcceptLoss: true });
    expect(items.find((i) => i.title === '돈이 묶이는 기간')?.level).toBe('ok');
    expect(items.some((i) => i.level === 'mismatch')).toBe(false);
  });
});

const SAMPLE_XML = `<?xml version="1.0" encoding="utf-8"?>
<DOCUMENT><DOCUMENT-NAME>증권신고서(투자계약증권)</DOCUMENT-NAME>
<BODY>
<SECTION-1><TITLE ATOC="Y">제1부 모집 또는 매출에 관한 사항</TITLE>
<P>본 투자계약증권의 1증권당 발행가액은 10,000원이며, 최소 청약단위는 10증권입니다.</P>
<TABLE><TR><TD>모집총액</TD><TD>1,200,000,000원</TD></TR></TABLE>
</SECTION-1>
<SECTION-1><TITLE ATOC="Y">제2부 III. 투자위험요소</TITLE>
<P>기초자산인 미술품은 공동사업 기간(5년) 만료 시까지 매각되지 않을 수 있으며, 이 경우 투자원금 회수가 지연될 수 있습니다.</P>
<P>투자자는 매각차익의 20%를 성과보수로 부담합니다. &amp; 보관료는 연 1.5%입니다.</P>
</SECTION-1>
</BODY></DOCUMENT>`;

describe('docparse', () => {
  it('XML → 섹션, 표, 엔티티', () => {
    const s = xmlToSections(SAMPLE_XML);
    expect(s.map((x) => x.title)).toEqual(['표지', '제1부 모집 또는 매출에 관한 사항', '제2부 III. 투자위험요소']);
    expect(s[0].text).toContain('증권신고서(투자계약증권)');
    expect(s[1].text).toContain('모집총액 | 1,200,000,000원');
    expect(s[2].text).toContain('& 보관료는 연 1.5%');
  });

  it('zip(UTF-8 + EUC-KR) 해석', () => {
    const euc = SAMPLE_XML.replace('utf-8', 'euc-kr');
    const zip = zipSync({ '20240101000001.xml': strToU8(SAMPLE_XML), '20240101000001_00760.xml': new Uint8Array(iconv.encode(euc, 'euc-kr')) });
    const sections = parseDartZip(zip);
    expect(sections.length).toBe(6);
    expect(sections[5].text).toContain('매각되지 않을 수 있으며');
  });

  it('인용 검증: 정확 일치·공백 차이 통과, 지어낸 문장 실패', () => {
    const full = normalize(xmlToSections(SAMPLE_XML).map((s) => s.text).join('\n'));
    expect(verifyQuote('공동사업 기간(5년) 만료 시까지 매각되지 않을 수 있으며', full)).toBe(true);
    expect(verifyQuote('1증권당   발행가액은 10,000원이며', full)).toBe(true);
    expect(verifyQuote('투자원금은 만기에 전액 보장됩니다', full)).toBe(false);
    expect(verifyQuote('짧음', full)).toBe(false);
  });

  it('섹션 선택은 수수료·위험 섹션을 우선', () => {
    const filler = Array.from({ length: 30 }, (_, i) => ({ title: `기타 ${i}`, text: '회사 연혁과 조직도에 관한 설명입니다. '.repeat(200) }));
    const key = { title: '수수료 및 보수에 관한 사항', text: '판매수수료 매각수수료 보수 비용 부담 '.repeat(50) };
    const picked = selectSections([...filler.slice(0, 10), key, ...filler.slice(10)], 20000);
    expect(picked.some((s) => s.title === key.title)).toBe(true);
  });
});

// ── API 라우트: DART·OpenAI를 가짜로 바꿔 전체 흐름 확인 ─────────────────
describe('api/analyze + api/chat (mocked upstream)', () => {
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  beforeEach(() => {
    process.env.DART_API_KEY = 'test-dart';
    process.env.OPENAI_API_KEY = 'test-openai';
    process.env.OPENAI_MODEL = 'gpt-5.4-mini';
    calls.length = 0;
    const zip = zipSync({ 'a.xml': strToU8(SAMPLE_XML) });
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/document.xml')) return new Response(zip, { status: 200 });
      if (url.includes('api.openai.com')) {
        const body = JSON.parse(String(init?.body));
        if (body.response_format) {
          expect(body.response_format.json_schema.strict).toBe(true);
          expect(body.reasoning_effort).toBe('low');
          expect(body.messages[1].content).toContain('## 제2부 III. 투자위험요소');
          const tf = (value: string, section: string, quote: string) => ({ value, found: true, section, quote });
          const nf = (value: number | null, section = '', quote = '') => ({ value, section, quote });
          const raw = {
            product_name: '테스트 미술품 1호',
            issuer: '테스트컴퍼니',
            asset_type: '미술품',
            underlying: '현대미술 작품 1점',
            one_line: '작품을 팔면 차익을 나눠 받는 구조예요.',
            how_to_earn: tf('작품 매각 차익을 나눠요.', '제2부 III. 투자위험요소', '투자자는 매각차익의 20%를 성과보수로 부담합니다.'),
            lockup: tf('최대 5년 묶일 수 있어요.', '제2부 III. 투자위험요소', '공동사업 기간(5년) 만료 시까지 매각되지 않을 수 있으며'),
            how_to_exit: tf('매각 후 정산해요.', '제2부 III. 투자위험요소', '이 문장은 원문에 없는 지어낸 인용입니다 확인용'),
            fees: tf('성과보수 20%, 보관료 연 1.5%', '제2부 III. 투자위험요소', '보관료는 연 1.5%입니다.'),
            distribution: { value: '문서에서 확인 불가', found: false, section: '', quote: '' },
            regular_distribution: false,
            secondary_market: { value: '확인불가', section: '', quote: '' },
            numbers: {
              price_per_unit: nf(10000, '제1부 모집 또는 매출에 관한 사항', '1증권당 발행가액은 10,000원이며'),
              min_units: nf(10, '제1부 모집 또는 매출에 관한 사항', '최소 청약단위는 10증권입니다.'),
              offering_amount: nf(1200000000, '제1부 모집 또는 매출에 관한 사항', '모집총액 | 1,200,000,000원'),
              holding_months_min: nf(60, '제2부 III. 투자위험요소', '공동사업 기간(5년)'),
              holding_months_max: nf(60, '제2부 III. 투자위험요소', '공동사업 기간(5년) 만료 시까지'),
              buy_fee_pct: nf(null),
              sell_fee_pct: nf(null),
              annual_fee_pct: nf(1.5, '제2부 III. 투자위험요소', '보관료는 연 1.5%입니다.'),
              success_fee_pct: nf(20, '제2부 III. 투자위험요소', '매각차익의 20%를 성과보수로 부담합니다.'),
            },
            risks: [{ title: '매각 지연', explanation: '5년 안에 안 팔릴 수 있어요.', section: '제2부 III. 투자위험요소', quote: '투자원금 회수가 지연될 수 있습니다.' }],
            unknowns: ['중도 매도 가능 여부'],
          };
          return Response.json({ choices: [{ message: { content: JSON.stringify(raw) }, finish_reason: 'stop' }] });
        }
        expect(body.messages[0].content).toContain('[증권신고서 원문 발췌');
        return Response.json({ choices: [{ message: { content: '최대 5년까지 매각되지 않을 수 있어요. [근거: 제2부 III. 투자위험요소]' } }] });
      }
      throw new Error('unexpected fetch ' + url);
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('신고서 분석 → 근거 검증 → 캐시 → 챗봇', async () => {
    const { POST } = await import('@/app/api/analyze/route');
    const filing = { rceptNo: '20240101000001', corpCode: '01234567', corpName: '테스트컴퍼니', reportName: '증권신고서(투자계약증권)', receivedAt: '20240101', url: '' };
    const mk = () => new Request('http://x/api/analyze', { method: 'POST', body: JSON.stringify({ rceptNo: filing.rceptNo, filing }), headers: { 'x-forwarded-for': '1.1.1.1' } });
    const res = await POST(mk());
    expect(res.status).toBe(200);
    const { product, cached } = (await res.json()) as { product: Product; cached: boolean };
    expect(cached).toBe(false);
    expect(product.id).toBe('dart-20240101000001');
    expect(product.howToEarn.evidence?.verified).toBe(true);
    expect(product.lockup.evidence?.verified).toBe(true);
    expect(product.howToExit.evidence?.verified).toBe(false); // 지어낸 인용은 걸러냄
    expect(product.distribution.found).toBe(false);
    expect(product.numbers.buyFeePct.value).toBeNull();
    expect(product.numbers.successFeePct.value).toBe(20);
    expect(product.verifiedRatio).toBeGreaterThan(0.8);
    expect(product.verifiedRatio).toBeLessThan(1);
    // 키는 응답에 섞이지 않는다
    expect(JSON.stringify(product)).not.toContain('test-dart');

    // 두 번째 요청은 캐시
    const before = calls.length;
    const res2 = await POST(mk());
    expect(((await res2.json()) as { cached: boolean }).cached).toBe(true);
    expect(calls.length).toBe(before);

    // 공유 라이브러리
    const lib = await import('@/app/api/library/route');
    const libJson = (await (await lib.GET()).json()) as { products: Product[] };
    expect(libJson.products.map((p) => p.id)).toContain(product.id);

    // 챗봇: 원문 발췌를 근거로 답변
    const chat = await import('@/app/api/chat/route');
    const cres = await chat.POST(new Request('http://x/api/chat', { method: 'POST', body: JSON.stringify({ question: '언제 돌려받나요?', product }) }));
    expect(cres.status).toBe(200);
    expect(((await cres.json()) as { answer: string }).answer).toContain('근거');
  });

  it('잘못된 접수번호는 400', async () => {
    const { POST } = await import('@/app/api/analyze/route');
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ rceptNo: '123' }) }));
    expect(res.status).toBe(400);
  });
});

import { sampleAnswer } from '@/lib/sampleAnswers';
describe('sample answers (preset questions, no AI)', () => {
  it('상품 선택 시 상품 정보로 답변', () => {
    expect(sampleAnswer('투자금은 언제 돌려받아요?', art)).toContain('푸른 정원 01');
    expect(sampleAnswer('수수료는 어떤 게 있어요?', art)).toContain('성과보수 이익의 20%');
    expect(sampleAnswer('중간에 팔 수 있어요?', art)).toContain('중간에 팔기 어려운');
    expect(sampleAnswer('가장 큰 위험이 뭐예요?', bld)).toContain('공실');
  });
  it('상품 미선택 시 일반 답변', () => {
    expect(sampleAnswer('수수료는 어떤 게 있어요?', null)).toContain('총비용');
  });
});
