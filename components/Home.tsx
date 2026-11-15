'use client';
import type { Product } from '@/lib/types';
import { Portfolio } from './Assets';
import { ProductCard } from './ui';

interface Props {
  real: Product[];
  samples: Product[];
  owned: Record<string, number>;
  all: Product[];
  hasProfile: boolean;
  go: (page: string) => void;
  onOpen: (id: string) => void;
}

export default function Home({ real, samples, owned, all, hasProfile, go, onOpen }: Props) {
  const featured = (real.length ? real : samples).slice(0, 3);
  const hasAssets = Object.keys(owned).length > 0;
  return (
    <section>
      <div className="welcome">
        <div className="eyebrow">YOUR INVESTMENT COMPASS</div>
        <h1>안녕하세요 👋</h1>
        <p>오늘도 내 투자를 조금 더 잘 이해하는 하루.</p>
      </div>

      {hasAssets && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-title">
            내 조각자산
            <button className="text-btn" onClick={() => go('assets')}>
              자세히 →
            </button>
          </div>
          <Portfolio owned={owned} products={all} />
        </div>
      )}

      <div className="hero">
        <div className="hero-copy">
          <div className="hero-tag">START WITH CONFIDENCE</div>
          <h2>
            작은 조각부터,
            <br />
            나에게 맞는 투자를 찾아요.
          </h2>
          <p>어려운 증권신고서는 쉽게, 중요한 차이는 한눈에.</p>
          <button className="primary" onClick={() => go(hasProfile ? 'discover' : 'profile')}>
            {hasProfile ? '상품 둘러보기 ↗' : '내 투자 기준 설정하기 ↗'}
          </button>
        </div>
        <div className="art" aria-hidden="true">
          <div className="orb" />
          <div className="compass">✦</div>
        </div>
      </div>

      <div className="section-head">
        <div>
          <h2>{real.length ? '최근 분석된 상품' : '이렇게 정리해 드려요'}</h2>
          <p>{real.length ? 'DART 증권신고서를 AI가 읽고 정리했어요.' : '가상 예시로 먼저 살펴보세요.'}</p>
        </div>
        <button className="text-btn" onClick={() => go('discover')}>
          전체 보기 →
        </button>
      </div>
      <div className="cards">
        {featured.map((p) => (
          <ProductCard key={p.id} p={p} onOpen={() => onOpen(p.id)} />
        ))}
      </div>

      <div className="risk">
        <span>ⓘ</span>
        <div>
          <strong>투자하기 전 꼭 확인해요</strong>
          <br />
          소액으로 시작할 수 있어도, 원할 때 원하는 가격에 현금화하지 못할 수 있어요. 미술품·한우 상품은 자산이 팔리기 전까지 돈이 묶이는 경우가 많아요.
        </div>
      </div>
    </section>
  );
}
