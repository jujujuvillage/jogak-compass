// 앱 전체에서 쓰는 데이터 형태.

export type AssetType = '부동산' | '미술품' | '한우' | '음악' | '기타';

/** 원문 근거. quote는 원문에서 그대로 옮긴 문장, verified는 서버가 원문에서 실제로 찾았는지 여부. */
export interface Evidence {
  section: string;
  quote: string;
  verified: boolean;
}

/** 쉬운 말 설명 한 항목. found=false면 "문서에서 확인 불가". */
export interface TextField {
  value: string;
  found: boolean;
  evidence: Evidence | null;
}

/** 계산에 쓰는 숫자 한 항목. value=null이면 문서에서 확인 불가. */
export interface NumberField {
  value: number | null;
  evidence: Evidence | null;
}

export type SecondaryMarket = '가능' | '불가' | '확인불가';

export interface ProductNumbers {
  pricePerUnit: NumberField; // 1증권(1주)당 가격, 원
  minUnits: NumberField; // 최소 청약 수량
  offeringAmount: NumberField; // 총 모집 금액, 원
  holdingMonthsMin: NumberField; // 예상 보유(투자) 기간 최소, 개월
  holdingMonthsMax: NumberField; // 예상 보유 기간 최대(만기), 개월
  buyFeePct: NumberField; // 매수(청약) 시 투자자 부담 수수료, 투자금 대비 %
  sellFeePct: NumberField; // 매각·정산 시 매각대금 대비 수수료 %
  annualFeePct: NumberField; // 연간 운용·관리·보관 보수 %
  successFeePct: NumberField; // 성과보수, 이익 대비 %
}

export interface Risk {
  title: string;
  explanation: string;
  evidence: Evidence | null;
}

export interface Product {
  id: string; // 'dart-<rcept_no>' 또는 'sample-<id>'
  source: 'dart' | 'sample';
  name: string;
  issuer: string;
  assetType: AssetType;
  icon: string;
  underlying: string;
  oneLine: string; // 쉬운 말 한 줄 요약
  howToEarn: TextField; // 돈 버는 방식
  lockup: TextField; // 돈이 묶이는 기간
  howToExit: TextField; // 돌려받는 방법
  fees: TextField; // 수수료 설명
  distribution: TextField; // 정기 분배 여부와 주기
  regularDistribution: boolean | null; // 정기 분배가 있는지
  secondaryMarket: SecondaryMarket; // 중도 매도(유통) 가능 여부
  secondaryMarketEvidence: Evidence | null;
  numbers: ProductNumbers;
  risks: Risk[];
  unknowns: string[]; // 문서에서 확인하지 못한 것
  dart?: {
    rceptNo: string;
    corpCode: string;
    corpName: string;
    reportName: string;
    receivedAt: string; // YYYYMMDD
    url: string;
  };
  analyzedAt?: string;
  model?: string;
  verifiedRatio?: number; // 근거 인용 검증 통과 비율 0~1
}

export interface Filing {
  rceptNo: string;
  corpCode: string;
  corpName: string;
  reportName: string;
  receivedAt: string;
  url: string;
}

export interface UserProfile {
  needMoneyInMonths: number | null; // 돈이 필요할 수 있는 시점(개월 후). null=정하지 않음
  purpose: '정기수익' | '목돈' | '경험' | null;
  mayNeedEarlyExit: boolean; // 중간에 꺼내야 할 수도 있음
  canAcceptLoss: boolean; // 원금 손실을 감수할 수 있음
  interests: string[];
  monthlyBudget: number | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
