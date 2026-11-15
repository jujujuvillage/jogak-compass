// 증권신고서 → 상품 구조 카드. LLM은 읽고 옮겨 적기만 하고, 근거 인용은 서버가 원문과 대조한다.
import type { AssetType, Evidence, Filing, NumberField, Product, SecondaryMarket, TextField } from './types';
import { normalize, sectionsToPrompt, selectSections, verifyQuote, type Section } from './docparse';
import { chatJSON, model } from './openai';

const EV_PROPS = { section: { type: 'string' }, quote: { type: 'string' } };
const textField = {
  type: 'object',
  additionalProperties: false,
  properties: { value: { type: 'string' }, found: { type: 'boolean' }, ...EV_PROPS },
  required: ['value', 'found', 'section', 'quote'],
};
const numField = {
  type: 'object',
  additionalProperties: false,
  properties: { value: { type: ['number', 'null'] }, ...EV_PROPS },
  required: ['value', 'section', 'quote'],
};
const NUM_KEYS = ['price_per_unit', 'min_units', 'offering_amount', 'holding_months_min', 'holding_months_max', 'buy_fee_pct', 'sell_fee_pct', 'annual_fee_pct', 'success_fee_pct'] as const;

export const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    product_name: { type: 'string' },
    issuer: { type: 'string' },
    asset_type: { type: 'string', enum: ['부동산', '미술품', '한우', '음악', '기타'] },
    underlying: { type: 'string' },
    one_line: { type: 'string' },
    how_to_earn: textField,
    lockup: textField,
    how_to_exit: textField,
    fees: textField,
    distribution: textField,
    regular_distribution: { type: ['boolean', 'null'] },
    secondary_market: {
      type: 'object',
      additionalProperties: false,
      properties: { value: { type: 'string', enum: ['가능', '불가', '확인불가'] }, ...EV_PROPS },
      required: ['value', 'section', 'quote'],
    },
    numbers: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(NUM_KEYS.map((k) => [k, numField])),
      required: [...NUM_KEYS],
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, explanation: { type: 'string' }, ...EV_PROPS },
        required: ['title', 'explanation', 'section', 'quote'],
      },
    },
    unknowns: { type: 'array', items: { type: 'string' } },
  },
  required: ['product_name', 'issuer', 'asset_type', 'underlying', 'one_line', 'how_to_earn', 'lockup', 'how_to_exit', 'fees', 'distribution', 'regular_distribution', 'secondary_market', 'numbers', 'risks', 'unknowns'],
};

type RawText = { value: string; found: boolean; section: string; quote: string };
type RawNum = { value: number | null; section: string; quote: string };
interface Raw {
  product_name: string;
  issuer: string;
  asset_type: AssetType;
  underlying: string;
  one_line: string;
  how_to_earn: RawText;
  lockup: RawText;
  how_to_exit: RawText;
  fees: RawText;
  distribution: RawText;
  regular_distribution: boolean | null;
  secondary_market: { value: SecondaryMarket; section: string; quote: string };
  numbers: Record<(typeof NUM_KEYS)[number], RawNum>;
  risks: { title: string; explanation: string; section: string; quote: string }[];
  unknowns: string[];
}

const SYSTEM = `당신은 조각투자(투자계약증권) 증권신고서를 입문자에게 설명하는 분석가예요.
반드시 지킬 규칙:
1. 제공된 문서 내용만 근거로 써요. 문서에 없는 내용은 추측하지 말고 found=false, value="문서에서 확인 불가", quote="" 로 둬요.
2. quote에는 문서 문장을 한 글자도 바꾸지 말고 그대로 복사해요(10~120자). section에는 그 문장이 속한 "## " 제목을 그대로 적어요.
3. 설명(value, one_line, explanation)은 20~30대 입문자가 이해할 쉬운 해요체 한국어로, 전문용어는 풀어서 써요.
4. 매수·매도·보유를 권하거나 수익을 전망하지 않아요. 좋다/나쁘다 평가도 하지 않아요.
5. numbers는 문서에 적힌 숫자만 옮겨요. 계산하거나 추정하지 말아요.
   - price_per_unit: 1증권(1구좌)당 발행가액(원). min_units: 최소 청약 수량. offering_amount: 모집(매출) 총액(원).
   - holding_months_min/max: 투자 기간·존속기간·만기를 개월로 바꾼 값(년×12만 허용). 하나만 있으면 둘 다 같은 값.
   - buy_fee_pct: 투자자가 청약·매수할 때 내는 수수료(투자금 대비 %). sell_fee_pct: 매각·정산 시 투자자 몫에서 빠지는 수수료(%).
   - annual_fee_pct: 매년 빠지는 운용·관리·보관·보험 보수(%/년). success_fee_pct: 이익(차익) 대비 성과보수(%).
   - 비율이 아니라 정액으로만 적혀 있거나 투자자가 부담하지 않으면 null로 두고 fees.value에 설명해요. 0%로 명시돼 있으면 0.
6. risks는 투자자에게 가장 중요한 위험 3~5개. unknowns에는 입문자가 궁금해할 텐데 문서에서 확인하지 못한 점을 적어요.
7. secondary_market: 만기 전에 다른 투자자에게 팔 수 있는 유통시장(장외거래소 등)이 문서에 있으면 '가능', 유통·양도가 제한된다고 적혀 있으면 '불가', 알 수 없으면 '확인불가'.`;

const ICON: Record<AssetType, string> = { 부동산: '🏢', 미술품: '🖼️', 한우: '🐂', 음악: '♫', 기타: '◇' };

export async function extractProduct(filing: Filing, sections: Section[]): Promise<Product> {
  const selected = selectSections(sections);
  const docText = sectionsToPrompt(selected);
  const raw = await chatJSON<Raw>({
    system: SYSTEM,
    user: `다음은 DART 공시 "${filing.reportName}" (${filing.corpName}, 접수 ${filing.receivedAt})의 일부예요. 규칙에 따라 상품 구조를 정리해 주세요.\n\n${docText}`,
    schemaName: 'product_card',
    schema: EXTRACT_SCHEMA,
  });
  return toProduct(raw, filing, sections);
}

export function toProduct(raw: Raw, filing: Filing, sections: Section[]): Product {
  const full = normalize(sections.map((s) => s.title + '\n' + s.text).join('\n'));
  let total = 0;
  let ok = 0;
  const ev = (section: string, quote: string): Evidence | null => {
    if (!quote || !quote.trim()) return null;
    const verified = verifyQuote(quote, full);
    total++;
    if (verified) ok++;
    return { section: section || '원문', quote: quote.trim(), verified };
  };
  const tf = (r: RawText): TextField => {
    const found = r.found && !!r.value && !/확인 ?불가/.test(r.value);
    return { value: found ? r.value : '문서에서 확인 불가', found, evidence: found ? ev(r.section, r.quote) : null };
  };
  const nf = (r: RawNum): NumberField => {
    const value = typeof r.value === 'number' && Number.isFinite(r.value) && r.value >= 0 ? r.value : null;
    return { value, evidence: value !== null ? ev(r.section, r.quote) : null };
  };
  const n = raw.numbers;
  return {
    id: `dart-${filing.rceptNo}`,
    source: 'dart',
    name: raw.product_name || filing.reportName,
    issuer: raw.issuer || filing.corpName,
    assetType: raw.asset_type,
    icon: ICON[raw.asset_type] ?? '◇',
    underlying: raw.underlying,
    oneLine: raw.one_line,
    howToEarn: tf(raw.how_to_earn),
    lockup: tf(raw.lockup),
    howToExit: tf(raw.how_to_exit),
    fees: tf(raw.fees),
    distribution: tf(raw.distribution),
    regularDistribution: raw.regular_distribution,
    secondaryMarket: raw.secondary_market.value,
    secondaryMarketEvidence: raw.secondary_market.value !== '확인불가' ? ev(raw.secondary_market.section, raw.secondary_market.quote) : null,
    numbers: {
      pricePerUnit: nf(n.price_per_unit),
      minUnits: nf(n.min_units),
      offeringAmount: nf(n.offering_amount),
      holdingMonthsMin: nf(n.holding_months_min),
      holdingMonthsMax: nf(n.holding_months_max),
      buyFeePct: nf(n.buy_fee_pct),
      sellFeePct: nf(n.sell_fee_pct),
      annualFeePct: nf(n.annual_fee_pct),
      successFeePct: nf(n.success_fee_pct),
    },
    risks: raw.risks.slice(0, 6).map((r) => ({ title: r.title, explanation: r.explanation, evidence: ev(r.section, r.quote) })),
    unknowns: raw.unknowns.slice(0, 8),
    dart: { ...filing },
    analyzedAt: new Date().toISOString(),
    model: model(),
    verifiedRatio: total ? ok / total : 0,
  };
}
