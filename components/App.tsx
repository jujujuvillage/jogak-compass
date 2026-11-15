'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Filing, Product, UserProfile } from '@/lib/types';
import { SAMPLE_PRODUCTS } from '@/lib/samples';
import { DEFAULT_PROFILE, api, useStored } from '@/lib/client';
import Home from './Home';
import Discover from './Discover';
import Compare from './Compare';
import Assets from './Assets';
import Profile from './Profile';
import ProductDetail from './ProductDetail';
import Chat from './Chat';
import { Footer } from './ui';

type Page = 'home' | 'discover' | 'compare' | 'assets' | 'profile';
const NAV: { id: Page; icon: string; label: string }[] = [
  { id: 'home', icon: '⌂', label: '홈' },
  { id: 'discover', icon: '◫', label: '둘러보기' },
  { id: 'compare', icon: '▤', label: '비교' },
  { id: 'assets', icon: '◉', label: '내 자산' },
  { id: 'profile', icon: '☷', label: '투자 기준' },
];

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [profile, setProfile] = useStored<UserProfile>('jc-profile', DEFAULT_PROFILE);
  const [profileSaved, setProfileSaved] = useStored<boolean>('jc-profile-saved', false);
  const [analyzed, setAnalyzed] = useStored<Product[]>('jc-analyzed', []);
  const [owned, setOwned] = useStored<Record<string, number>>('jc-owned', {});
  const [compareIds, setCompareIds] = useStored<string[]>('jc-compare', ['sample-building', 'sample-art1']);
  const [library, setLibrary] = useState<Product[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatCtx, setChatCtx] = useState<string | null>(null);
  const [pendingQ, setPendingQ] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [health, setHealth] = useState<{ openai: boolean; dart: boolean } | null>(null);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    window.setTimeout(() => setToastMsg((cur) => (cur === m ? null : cur)), 2600);
  }, []);

  useEffect(() => {
    api.library().then((r) => setLibrary(r.products)).catch(() => {});
    api.health().then(setHealth).catch(() => {});
  }, []);

  const real = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of [...library, ...analyzed]) map.set(p.id, p);
    return [...map.values()].sort((a, b) => (b.dart?.rceptNo ?? '').localeCompare(a.dart?.rceptNo ?? ''));
  }, [library, analyzed]);
  const all = useMemo(() => [...real, ...SAMPLE_PRODUCTS], [real]);
  const detail = all.find((p) => p.id === detailId) ?? null;

  const go = (p: string) => {
    setPage(p as Page);
    setDetailId(null);
    window.scrollTo(0, 0);
  };

  const analyze = async (f: Filing) => {
    setAnalyzing((a) => ({ ...a, [f.rceptNo]: true }));
    try {
      const { product } = await api.analyze(f);
      setAnalyzed((list) => [product, ...list.filter((x) => x.id !== product.id)].slice(0, 30));
      setDetailId(product.id);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setAnalyzing((a) => ({ ...a, [f.rceptNo]: false }));
    }
  };

  const ask = (q: string, productId?: string | null) => {
    if (productId !== undefined) setChatCtx(productId);
    setDetailId(null);
    setChatOpen(true);
    setPendingQ(q);
  };

  const toggleCompare = (id: string) => {
    setCompareIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length >= 4) {
        toast('비교는 최대 4개까지 할 수 있어요.');
        return ids;
      }
      return [...ids, id];
    });
  };

  const toggleOwned = (id: string) => {
    setOwned((o) => {
      const next = { ...o };
      if (id in next) {
        delete next[id];
        toast('내 자산에서 뺐어요.');
      } else {
        next[id] = 0;
        toast('내 자산에 등록했어요. 투자 금액은 ‘내 자산’에서 입력할 수 있어요.');
      }
      return next;
    });
  };

  return (
    <div className="app">
      <header className="top">
        <button className="logo" onClick={() => go('home')} aria-label="홈으로">
          <span className="logo-icon">✳</span>조각나침반
        </button>
        <span className="beta">BETA</span>
      </header>

      <main className="content">
        {health && (!health.openai || !health.dart) && (
          <div className="notice error" style={{ marginBottom: 14 }}>
            서버 설정이 끝나지 않았어요: {[!health.openai && 'OPENAI_API_KEY', !health.dart && 'DART_API_KEY'].filter(Boolean).join(', ')} 환경변수를 등록해 주세요.
          </div>
        )}
        {page === 'home' && <Home real={real} samples={SAMPLE_PRODUCTS} owned={owned} all={all} hasProfile={profileSaved} go={go} onOpen={setDetailId} />}
        {page === 'discover' && <Discover real={real} samples={SAMPLE_PRODUCTS} analyzing={analyzing} onAnalyze={analyze} onOpen={setDetailId} />}
        {page === 'compare' && <Compare products={all} selected={compareIds.filter((id) => all.some((p) => p.id === id))} onToggle={toggleCompare} profile={profile} onOpen={setDetailId} onEditProfile={() => go('profile')} />}
        {page === 'assets' && (
          <Assets
            owned={owned}
            products={all}
            setAmount={(id, amount) => setOwned((o) => ({ ...o, [id]: amount }))}
            onRemove={(id) => toggleOwned(id)}
            onOpen={setDetailId}
            onAsk={(q, id) => ask(q, id)}
            onBrowse={() => go('discover')}
          />
        )}
        {page === 'profile' && (
          <Profile
            key={JSON.stringify(profile)}
            profile={profile}
            onSave={(p) => {
              setProfile(p);
              setProfileSaved(true);
              toast('투자 기준을 저장했어요.');
              go('compare');
            }}
          />
        )}
        <Footer />
      </main>

      <nav className="mobile-nav" aria-label="주요 메뉴">
        {NAV.map((n) => (
          <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => go(n.id)} aria-current={page === n.id ? 'page' : undefined}>
            <span className="nav-icon" aria-hidden="true">
              {n.icon}
            </span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {!chatOpen && (
        <button className="chat-button" onClick={() => setChatOpen(true)}>
          ✦ &nbsp;에이전트에게 물어보기
        </button>
      )}
      <Chat open={chatOpen} onClose={() => setChatOpen(false)} products={all} contextId={chatCtx} setContextId={setChatCtx} pending={pendingQ} clearPending={() => setPendingQ(null)} />

      {detail && (
        <ProductDetail
          p={detail}
          profile={profile}
          owned={detail.id in owned}
          inCompare={compareIds.includes(detail.id)}
          onClose={() => setDetailId(null)}
          onToggleOwned={() => toggleOwned(detail.id)}
          onToggleCompare={() => toggleCompare(detail.id)}
          onAsk={(q) => ask(q, detail.id)}
          onEditProfile={() => go('profile')}
          onEvidence={() => {
            /* 성공 지표(원문 근거 클릭률) 측정 지점: 분석 도구를 붙이면 여기서 이벤트를 보내세요. */
          }}
        />
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}
