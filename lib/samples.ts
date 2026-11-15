// 프로토타입의 가상 예시 상품. 실제 상품이 아니며, 화면 구조를 익히는 용도로만 쓴다.
import type { AssetType, NumberField, Product, TextField } from './types';

const t = (value: string): TextField => ({ value, found: true, evidence: null });
const n = (value: number | null): NumberField => ({ value, evidence: null });

interface Seed {
  id: string;
  type: AssetType;
  icon: string;
  name: string;
  desc: string;
  source: string;
  exit: string;
  risk: string[];
  structure: string;
  price: number;
  fee: number;
  sellFee: number;
  annual: number;
  success: number;
  hMin: number | null;
  hMax: number | null;
  period: string;
  distribution: string;
  regular: boolean;
  market: '가능' | '불가';
}

const seeds: Seed[] = [
  { id: 'building', type: '부동산', icon: '🏢', name: '성수 어반 빌딩', desc: '공간의 가능성에 투자하는 한 조각', source: '건물 임대 운영에서 나온 임대료를 배당으로 나누고, 건물을 팔면 매각 차익을 정산해요.', exit: '중도 매도 주문을 낼 수 있다고 가정해요. 만기에는 건물 매각 후 정산해요.', risk: ['공실', '부동산 가격 변동', '매각 지연'], structure: '건물의 임대 운영이나 자산 매각 결과가 수익에 영향을 줘요.', price: 5000, fee: 0.2, sellFee: 0.2, annual: 0.5, success: 0, hMin: 36, hMax: 60, period: '목표 3~5년', distribution: '분기별 배당(금액 변동)', regular: true, market: '가능' },
  { id: 'music', type: '음악', icon: '♫', name: '우리의 여름', desc: '음악의 가치를 함께 나누는 한 조각', source: '곡이 쓰일 때 발생하는 저작권료를 보유 비율대로 나눠 받아요.', exit: '보유 증권을 마켓에서 매도할 수 있다고 가정해요. 정해진 만기는 없어요.', risk: ['저작권료 감소', '거래 가격 변동', '거래량 부족'], structure: '기초 권리에서 발생한 저작권료를 상품 조건에 따라 나눠 받을 수 있어요.', price: 12000, fee: 1, sellFee: 1, annual: 0, success: 0, hMin: null, hMax: null, period: '정해진 만기 없음', distribution: '매월 정산(금액 변동)', regular: true, market: '가능' },
  { id: 'building2', type: '부동산', icon: '🏬', name: '연남 스테이 빌딩', desc: '동네 상권을 담은 가상의 상업 공간', source: '임대 운영 수익을 반기마다 나누고, 매각 시 차익을 정산해요.', exit: '중도 매도 주문 가능 가정, 만기에 매각 후 정산해요.', risk: ['공실', '운영 비용 증가', '매각 지연'], structure: '운영 수익과 매각 결과에 따라 분배액이 달라질 수 있어요.', price: 10000, fee: 0.2, sellFee: 0.2, annual: 0.6, success: 0, hMin: 48, hMax: 72, period: '목표 4~6년', distribution: '반기별 배당(금액 변동)', regular: true, market: '가능' },
  { id: 'music2', type: '음악', icon: '♫', name: '별빛 산책', desc: '가상의 음악 저작권 수익증권', source: '기초 권리의 저작권료를 매월 분배해요.', exit: '보유 증권 매도 가정, 만기 없음.', risk: ['저작권료 감소', '거래 가격 변동'], structure: '기초 권리에서 발생한 저작권료를 조건에 따라 분배해요.', price: 8500, fee: 1, sellFee: 1, annual: 0, success: 0, hMin: null, hMax: null, period: '정해진 만기 없음', distribution: '매월 정산(금액 변동)', regular: true, market: '가능' },
  { id: 'art1', type: '미술품', icon: '🖼️', name: '푸른 정원 01', desc: '가상의 현대미술 작품 투자', source: '작품을 팔았을 때의 차익에서 비용을 빼고 나눠요. 그 전까지 배당은 없어요.', exit: '중도 매도는 불가 가정. 작품 매각·사업 청산 후 정산해요.', risk: ['작품 가치 하락', '매각 지연(만기까지 안 팔릴 수 있음)', '보관·보험 비용'], structure: '작품 매각 결과에서 비용을 반영한 손익을 나누는 가상 구조예요.', price: 20000, fee: 0, sellFee: 0, annual: 1.5, success: 20, hMin: 36, hMax: 60, period: '목표 3~5년', distribution: '정기 지급 없음, 매각 후 일시 정산', regular: false, market: '불가' },
  { id: 'art2', type: '미술품', icon: '🎨', name: '빛의 조각', desc: '가상의 추상회화 작품 투자', source: '작품의 실제 매각 결과에 따라 손익을 나눠요.', exit: '중도 매도 불가 가정. 매각 후 정산해요.', risk: ['평가가격과 매각가격 차이', '매각 지연'], structure: '작품의 실제 매각 결과에 따라 수익 또는 손실이 발생할 수 있어요.', price: 10000, fee: 0, sellFee: 0, annual: 1.2, success: 20, hMin: 24, hMax: 48, period: '목표 2~4년', distribution: '정기 지급 없음, 매각 후 일시 정산', regular: false, market: '불가' },
  { id: 'cow1', type: '한우', icon: '🐂', name: '푸른목장 한우 1호', desc: '가상의 한우 사육 프로젝트', source: '송아지를 길러 경매에서 판 금액에서 사육 비용을 빼고 나눠요.', exit: '중도 매도 불가 가정. 사육 종료 후 경매 매각·정산해요.', risk: ['사육 비용 증가', '질병·폐사', '경매가 하락'], structure: '사육을 마친 한우의 매각 결과와 비용에 따라 정산해요.', price: 40000, fee: 0, sellFee: 0, annual: 0, success: 10, hMin: 20, hMax: 26, period: '예상 20~26개월', distribution: '정기 지급 없음, 매각 후 일시 정산', regular: false, market: '불가' },
  { id: 'cow2', type: '한우', icon: '🌾', name: '햇살목장 한우 2호', desc: '가상의 한우 사육 프로젝트', source: '사육 및 매각 결과에 따라 손익을 나눠요.', exit: '중도 매도 불가 가정. 매각 후 정산해요.', risk: ['질병', '사료비 상승', '매각 시점 변동'], structure: '사육 및 매각 결과에 따라 손익이 발생하는 가상 프로젝트예요.', price: 50000, fee: 0, sellFee: 0, annual: 0, success: 10, hMin: 18, hMax: 24, period: '예상 18~24개월', distribution: '정기 지급 없음, 매각 후 일시 정산', regular: false, market: '불가' },
];

export const SAMPLE_PRODUCTS: Product[] = seeds.map((s) => ({
  id: `sample-${s.id}`,
  source: 'sample',
  name: s.name,
  issuer: '가상 발행사',
  assetType: s.type,
  icon: s.icon,
  underlying: s.desc,
  oneLine: s.structure,
  howToEarn: t(s.source),
  lockup: t(s.period),
  howToExit: t(s.exit),
  fees: t(`매수 ${s.fee}% · 매각 ${s.sellFee}% · 연 보수 ${s.annual}%${s.success ? ` · 성과보수 이익의 ${s.success}%` : ''} (가정)`),
  distribution: t(s.distribution),
  regularDistribution: s.regular,
  secondaryMarket: s.market,
  secondaryMarketEvidence: null,
  numbers: {
    pricePerUnit: n(s.price),
    minUnits: n(1),
    offeringAmount: n(null),
    holdingMonthsMin: n(s.hMin),
    holdingMonthsMax: n(s.hMax),
    buyFeePct: n(s.fee),
    sellFeePct: n(s.sellFee),
    annualFeePct: n(s.annual),
    successFeePct: n(s.success),
  },
  risks: s.risk.map((r) => ({ title: r, explanation: `${r} 가능성이 있어요(가상 예시).`, evidence: null })),
  unknowns: ['가상 예시 상품이라 실제 증권신고서가 없어요.'],
}));
