'use client';
import { useEffect, useState } from 'react';
import type { AssetType, Filing, Product } from '@/lib/types';
import { api, fmtDate } from '@/lib/client';
import { ProductCard } from './ui';

interface Props {
  real: Product[];
  samples: Product[];
  analyzing: Record<string, boolean>;
  onAnalyze: (f: Filing) => void;
  onOpen: (id: string) => void;
}

const TYPES: ('전체' | AssetType)[] = ['전체', '부동산', '미술품', '한우', '음악', '기타'];

export default function Discover({ real, samples, analyzing, onAnalyze, onOpen }: Props) {
  const [filings, setFilings] = useState<Filing[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [searchInfo, setSearchInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<(typeof TYPES)[number]>('전체');
  const [showAll, setShowAll] = useState(false);
  const [showSamples, setShowSamples] = useState(real.length === 0);

  const load = async (query = '') => {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.filings(query);
      setFilings(r.filings);
      setSearchInfo(query ? (r.filings.length ? `"${query}" 검색 결과 ${r.filings.length}건` : `"${query}"에 해당하는 발행 공시를 찾지 못했어요.${r.corps?.length ? ` (찾은 회사: ${r.corps.join(', ')})` : ''}`) : null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const analyzedIds = new Set(real.map((p) => p.dart?.rceptNo));
  const shownReal = real.filter((p) => filter === '전체' || p.assetType === filter);
  const shownSamples = samples.filter((p) => filter === '전체' || p.assetType === filter);
  const list = filings ? (showAll ? filings : filings.slice(0, 8)) : [];

  return (
    <section>
      <div className="welcome">
        <div className="eyebrow">DISCOVER</div>
        <h1>상품 둘러보기</h1>
        <p>DART에 올라온 실제 증권신고서를 AI가 읽고, 상품 구조를 한 장으로 정리해 드려요.</p>
      </div>

      <div className="panel">
        <div className="panel-title">증권신고서 찾기</div>
        <p className="muted" style={{ margin: '4px 0 12px' }}>
          회사명, DART 공시 링크, 접수번호(14자리)로 찾을 수 있어요.
        </p>
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            load(q.trim());
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 열매컴퍼니, 스탁키퍼, dart.fss.or.kr/...rcpNo=" aria-label="증권신고서 검색" />
          <button className="primary" type="submit" disabled={loading}>
            찾기
          </button>
        </form>
        {searchInfo && (
          <p className="muted" style={{ marginTop: 10 }}>
            {searchInfo}{' '}
            <button
              className="link"
              onClick={() => {
                setQ('');
                load('');
              }}
            >
              전체 목록으로
            </button>
          </p>
        )}
      </div>

      <div className="section-head">
        <div>
          <h2>{searchInfo ? '검색한 공시' : '투자계약증권 증권신고서'}</h2>
          <p>분석하기를 누르면 원문을 읽고 30초~1분 안에 정리해요.</p>
        </div>
      </div>
      <div className="panel">
        {loading && !filings && (
          <>
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </>
        )}
        {err && <div className="notice error">{err}</div>}
        {filings && filings.length === 0 && !err && <p className="muted">표시할 공시가 없어요.</p>}
        {list.map((f) => {
          const done = analyzedIds.has(f.rceptNo);
          const busy = analyzing[f.rceptNo];
          return (
            <div className="filing" key={f.rceptNo}>
              <div className="grow">
                <h4>{f.reportName}</h4>
                <p>
                  {f.corpName} · {fmtDate(f.receivedAt)} ·{' '}
                  <a href={f.url} target="_blank" rel="noreferrer">
                    원문 ↗
                  </a>
                </p>
              </div>
              <div className="act">
                {done ? (
                  <button className="btn-sm ghost" onClick={() => onOpen(`dart-${f.rceptNo}`)}>
                    결과 보기
                  </button>
                ) : (
                  <button className="btn-sm" disabled={busy} onClick={() => onAnalyze(f)}>
                    {busy ? (
                      <>
                        <span className="spinner" />
                        읽는 중
                      </>
                    ) : (
                      '분석하기'
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filings && filings.length > 8 && (
          <button className="text-btn" onClick={() => setShowAll(!showAll)} style={{ marginTop: 8 }}>
            {showAll ? '접기' : `${filings.length - 8}건 더 보기`}
          </button>
        )}
      </div>

      <div className="filters">
        {TYPES.map((t) => (
          <button key={t} className={`filter${filter === t ? ' active' : ''}`} onClick={() => setFilter(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="section-head" style={{ marginTop: 10 }}>
        <div>
          <h2>분석된 실제 상품 · {shownReal.length}</h2>
          <p>지금까지 조각나침반 사용자들이 분석한 공시예요.</p>
        </div>
      </div>
      {shownReal.length === 0 ? (
        <p className="muted">아직 분석된 상품이 없어요. 위 목록에서 분석하기를 눌러 보세요.</p>
      ) : (
        <div className="cards">
          {shownReal.map((p) => (
            <ProductCard key={p.id} p={p} onOpen={() => onOpen(p.id)} />
          ))}
        </div>
      )}

      <div className="section-head">
        <div>
          <h2>가상 예시 상품 · {shownSamples.length}</h2>
          <p>화면 구조와 비교 기능을 익히기 위한 가상의 상품이에요.</p>
        </div>
        <button className="text-btn" onClick={() => setShowSamples(!showSamples)}>
          {showSamples ? '접기' : '펼치기'}
        </button>
      </div>
      {showSamples && (
        <div className="cards">
          {shownSamples.map((p) => (
            <ProductCard key={p.id} p={p} onOpen={() => onOpen(p.id)} />
          ))}
        </div>
      )}
    </section>
  );
}
