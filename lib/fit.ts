// "나와 맞는지 체크": 매수를 추천하지 않고, 상품 조건과 사용자 조건의 일치 여부만 표시한다.
import type { Product, UserProfile } from './types';
import { monthsLabel } from './calc';

export type FitLevel = 'ok' | 'warn' | 'mismatch' | 'unknown';

export interface FitItem {
  level: FitLevel;
  title: string;
  detail: string;
}

export function checkFit(p: Product, u: UserProfile): FitItem[] {
  const items: FitItem[] = [];
  const minM = p.numbers.holdingMonthsMin.value;
  const maxM = p.numbers.holdingMonthsMax.value;
  const period = monthsLabel(minM, maxM);

  // 1) 돈이 필요한 시점 vs 묶이는 기간
  if (u.needMoneyInMonths === null) {
    items.push({ level: 'unknown', title: '돈이 필요한 시점', detail: '투자 기준에서 시점을 정하면 비교할 수 있어요.' });
  } else if (maxM === null && minM === null) {
    items.push({ level: 'unknown', title: '돈이 묶이는 기간', detail: '문서에서 보유 기간을 확인하지 못했어요. 원문에서 만기·매각 시점을 확인해 주세요.' });
  } else {
    const longest = (maxM ?? minM) as number;
    const shortest = (minM ?? maxM) as number;
    if (shortest > u.needMoneyInMonths) {
      items.push({ level: 'mismatch', title: '돈이 묶이는 기간', detail: `예상 보유 기간(${period})이 돈이 필요할 수 있는 시점(${u.needMoneyInMonths}개월 후)보다 길어요.` });
    } else if (longest > u.needMoneyInMonths) {
      items.push({ level: 'warn', title: '돈이 묶이는 기간', detail: `예상 보유 기간(${period})이 길어지면 돈이 필요한 시점(${u.needMoneyInMonths}개월 후)을 넘길 수 있어요. 매각은 지연될 수도 있어요.` });
    } else {
      items.push({ level: 'ok', title: '돈이 묶이는 기간', detail: `예상 보유 기간(${period})이 돈이 필요한 시점 안에 있어요. 다만 매각 지연 가능성은 남아 있어요.` });
    }
  }

  // 2) 중간에 꺼낼 수 있는지
  if (u.mayNeedEarlyExit) {
    if (p.secondaryMarket === '불가') {
      items.push({ level: 'mismatch', title: '중간에 돈 빼기', detail: '중도 매도(유통)가 어려운 상품이에요. 자산이 팔릴 때까지 돈을 돌려받기 어려워요.' });
    } else if (p.secondaryMarket === '가능') {
      items.push({ level: 'warn', title: '중간에 돈 빼기', detail: '중도 매도 경로가 있지만, 사려는 사람이 없으면 원하는 때·가격에 팔지 못할 수 있어요.' });
    } else {
      items.push({ level: 'unknown', title: '중간에 돈 빼기', detail: '문서에서 중도 매도 가능 여부를 확인하지 못했어요.' });
    }
  }

  // 3) 투자 목적
  if (u.purpose === '정기수익') {
    if (p.regularDistribution === true) items.push({ level: 'ok', title: '정기적인 수익', detail: '보유 중 정기 분배가 있는 구조예요. 금액은 변동되며 보장되지 않아요.' });
    else if (p.regularDistribution === false) items.push({ level: 'mismatch', title: '정기적인 수익', detail: '보유 중 정기 분배가 없고, 자산을 판 뒤 한 번에 정산하는 구조예요.' });
    else items.push({ level: 'unknown', title: '정기적인 수익', detail: '정기 분배 여부를 문서에서 확인하지 못했어요.' });
  } else if (u.purpose === '목돈') {
    items.push({ level: 'warn', title: '목돈 불리기', detail: '수익은 자산 매각 결과에 달려 있어요. 실수익 계산기에서 비관 시나리오도 함께 확인해 보세요.' });
  }

  // 4) 원금 손실
  items.push(
    u.canAcceptLoss
      ? { level: 'warn', title: '원금 손실', detail: '원금 보장이 없는 상품이에요. 감수할 수 있다고 선택하셨어요.' }
      : { level: 'mismatch', title: '원금 손실', detail: '원금 손실을 원하지 않는다고 선택하셨는데, 이 상품은 원금이 보장되지 않아요.' },
  );

  // 5) 예산
  const price = p.numbers.pricePerUnit.value;
  if (u.monthlyBudget && price) {
    const minAmt = price * (p.numbers.minUnits.value ?? 1);
    if (minAmt > u.monthlyBudget) items.push({ level: 'warn', title: '최소 투자금', detail: `최소 투자금(${Math.round(minAmt).toLocaleString('ko-KR')}원)이 월 투자 예산보다 커요.` });
  }
  return items;
}
