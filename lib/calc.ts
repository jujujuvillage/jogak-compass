// 숫자 계산은 전부 여기서 코드로 한다(LLM은 숫자를 계산하지 않는다).
import type { Product } from './types';

export const DEFAULT_TAX_PCT = 15.4; // 배당소득세(지방세 포함) 가정
export const DEFAULT_DEPOSIT_RATE_PCT = 3.0; // 예금 금리 가정(연)

const r2 = (n: number) => Math.round(n);

export interface FeeRates {
  buyFeePct: number;
  sellFeePct: number;
  annualFeePct: number;
  successFeePct: number;
  /** 문서에서 확인하지 못해 0으로 계산한 항목 */
  missing: string[];
}

export function feeRates(p: Product): FeeRates {
  const n = p.numbers;
  const missing: string[] = [];
  const pick = (v: number | null, label: string) => {
    if (v === null || !Number.isFinite(v)) {
      missing.push(label);
      return 0;
    }
    return v;
  };
  return {
    buyFeePct: pick(n.buyFeePct.value, '매수 수수료'),
    sellFeePct: pick(n.sellFeePct.value, '매각 수수료'),
    annualFeePct: pick(n.annualFeePct.value, '연간 보수'),
    successFeePct: pick(n.successFeePct.value, '성과보수'),
    missing,
  };
}

export interface CostBreakdown {
  buyFee: number;
  annualFees: number;
  sellFee: number;
  total: number;
  totalPct: number; // 투자금 대비
  missing: string[];
}

/** "N년 보유 시 총비용": 자산 가치가 그대로라고 가정했을 때 수수료·보수 합계. 성과보수는 이익이 없으므로 0. */
export function holdingCost(p: Product, amount: number, years: number): CostBreakdown {
  const f = feeRates(p);
  const buyFee = (amount * f.buyFeePct) / 100;
  const annualFees = (amount * f.annualFeePct * years) / 100;
  const sellFee = (amount * f.sellFeePct) / 100;
  const total = buyFee + annualFees + sellFee;
  return {
    buyFee: r2(buyFee),
    annualFees: r2(annualFees),
    sellFee: r2(sellFee),
    total: r2(total),
    totalPct: amount > 0 ? (total / amount) * 100 : 0,
    missing: f.missing,
  };
}

export interface ScenarioInput {
  amount: number; // 투자금(상품 금액), 원
  years: number; // 보유 기간, 년
  valueChangePct: number; // 보유 기간 전체 동안 자산 가치 변화 가정, %
  distributionYieldPct: number; // 연 분배율 가정, % (정기 분배가 없으면 0)
  taxPct: number;
  depositRatePct: number;
}

export interface ScenarioResult {
  paid: number; // 실제로 낸 돈(투자금 + 매수 수수료)
  buyFee: number;
  distributions: number; // 보유 중 받은 분배금(세전)
  saleValue: number; // 매각 시 자산 가치
  sellFee: number;
  annualFees: number;
  successFee: number;
  tax: number;
  netReceipt: number; // 세후 실수령액(분배금 + 매각 정산금)
  netProfit: number;
  netReturnPct: number;
  depositReceipt: number; // 같은 돈을 예금에 넣었을 때 세후 수령액
  depositProfit: number;
  missing: string[];
}

export function runScenario(p: Product, s: ScenarioInput): ScenarioResult {
  const f = feeRates(p);
  const amount = Math.max(0, s.amount);
  const years = Math.max(0, s.years);
  const buyFee = (amount * f.buyFeePct) / 100;
  const paid = amount + buyFee;
  const annualFees = (amount * f.annualFeePct * years) / 100;
  const distributions = p.regularDistribution === false ? 0 : (amount * Math.max(0, s.distributionYieldPct) * years) / 100;
  const saleValue = Math.max(0, amount * (1 + s.valueChangePct / 100));
  const sellFee = (saleValue * f.sellFeePct) / 100;
  const saleProfitBeforeSuccess = saleValue - sellFee - annualFees - amount;
  const successFee = Math.max(0, saleProfitBeforeSuccess) * (f.successFeePct / 100);
  const taxable = Math.max(0, distributions + saleProfitBeforeSuccess - successFee);
  const tax = (taxable * Math.max(0, s.taxPct)) / 100;
  const netReceipt = saleValue - sellFee - annualFees - successFee + distributions - tax;
  const netProfit = netReceipt - paid;

  const grossInterest = paid * (Math.pow(1 + s.depositRatePct / 100, years) - 1);
  const depositReceipt = paid + grossInterest * (1 - s.taxPct / 100);

  return {
    paid: r2(paid),
    buyFee: r2(buyFee),
    distributions: r2(distributions),
    saleValue: r2(saleValue),
    sellFee: r2(sellFee),
    annualFees: r2(annualFees),
    successFee: r2(successFee),
    tax: r2(tax),
    netReceipt: r2(netReceipt),
    netProfit: r2(netProfit),
    netReturnPct: paid > 0 ? (netProfit / paid) * 100 : 0,
    depositReceipt: r2(depositReceipt),
    depositProfit: r2(depositReceipt - paid),
    missing: f.missing,
  };
}

export const SCENARIOS = [
  { key: 'good', label: '낙관', valueChangePct: 20 },
  { key: 'base', label: '기본', valueChangePct: 0 },
  { key: 'bad', label: '비관', valueChangePct: -30 },
] as const;

/** 최소 투자금 = 1주 가격 × 최소 수량 */
export function minInvestment(p: Product): number | null {
  const price = p.numbers.pricePerUnit.value;
  if (price === null) return null;
  const units = p.numbers.minUnits.value ?? 1;
  return r2(price * units);
}

export function defaultYears(p: Product): number {
  const max = p.numbers.holdingMonthsMax.value;
  const min = p.numbers.holdingMonthsMin.value;
  const m = max ?? min;
  if (!m) return 2;
  return Math.max(1, Math.round((m / 12) * 2) / 2);
}

export const won = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n) ? '확인 불가' : `${Math.round(n).toLocaleString('ko-KR')}원`;

export const pct = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined || !Number.isFinite(n) ? '확인 불가' : `${Number(n.toFixed(digits))}%`;

export function monthsLabel(min: number | null, max: number | null): string {
  if (min === null && max === null) return '확인 불가';
  const f = (m: number) => (m % 12 === 0 ? `${m / 12}년` : `${m}개월`);
  if (min !== null && max !== null && min !== max) return `${f(min)}~${f(max)}`;
  return f((max ?? min) as number);
}
