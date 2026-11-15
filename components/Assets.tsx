'use client';
import { useEffect, useState } from 'react';
import type { Filing, Product } from '@/lib/types';
import { api, fmtDate } from '@/lib/client';
import { won } from '@/lib/calc';

interface Props {
  owned: Record<string, number>;
  products: Product[];
  setAmount: (id: string, amount: number) => void;
  onRemove: (id: string) => void;
  onOpen: (id: string) => void;
  onAsk: (q: string, productId: string) => void;
  onBrowse: () => void;
}

export const TYPE_COLOR: Record<string, string> = { 부동산: '#5c9c72', 음악: '#9c8fd0', 미술품: '#d6a35c', 한우: '#b07a5a', 기타: '#9aa69e' };

export function Portfolio({ owned, products }: { owned: Record<string, number>; products: Product[] }) {
  const items = Object.entries(owned)
    .map(([id, amt]) => ({ p: products.find((x) => x.id === id), amt }))
    .filter((x) => x.p) as { p: Product; amt: number }[];
  const total = items.reduce((s, x) => s + (x.amt || 0), 0);
  const byType = new Map<string, number>();
  for (const x of items) byType.set(x.p.assetType, (byType.get(x.p.assetType) ?? 0) + (x.amt || 0));
  return (
    <>
      <div className="portfolio-total">{won(total)}</div>
      <div className="muted">직접 입력한 투자 금액 합계 · 수익률 미반영</div>
      {total > 0 && (
        <>
          <div className="bar">
            {[...byType].map(([t, v]) => (
              <i key={t} style={{ width: `${(v / total) * 100}%`, background: TYPE_COLOR[t] }} />
            ))}
          </div>
          {[...byType].map(([t, v]) => (
            <div className="asset-line" key={t}>
              <span>
                <i className="dot" style={{ background: TYPE_COLOR[t] }} />
                {t}
              </span>
              <b>{won(v)}</b>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function Disclosures({ p, onAsk }: { p: Product; onAsk: (q: string, id: string) => void }) {
  const [list, setList] = useState<Filing[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const corp = p.dart?.corpCode;
  useEffect(() => {
    if (!corp) return;
    api
      .disclosures(corp)
      .then((r) => setList(r.filings))
      .catch((e) => setErr(e.message));
  }, [corp]);
  if (!corp) return null;
  const after = list?.filter((f) => f.rceptNo > (p.dart?.rceptNo ?? '')) ?? [];
  return (
    <div className="panel">
      <div className="alert-top muted">
        {p.icon} {p.name} · {p.issuer}
      </div>
      <div className="panel-title" style={{ marginTop: 6 }}>
        발행사 최근 1년 공시
        {after.length > 0 && <span className="pill">신고서 이후 {after.length}건</span>}
      </div>
      {!list && !err && <div className="skeleton" />}
      {err && <p className="muted">{err}</p>}
      {list && list.length === 0 && <p className="muted">최근 1년 공시가 없어요.</p>}
      {list?.slice(0, 6).map((f) => (
        <div className="disc-item" key={f.rceptNo}>
          <a href={f.url} target="_blank" rel="noreferrer">
            {f.reportName} ↗
          </a>
          <div className="muted">{fmtDate(f.receivedAt)}</div>
        </div>
      ))}
      <button className="link" style={{ marginTop: 10 }} onClick={() => onAsk('이 상품의 최근 공시에서 확인해야 할 점이 있을까요?', p.id)}>
        에이전트에게 질문하기 ↗
      </button>
    </div>
  );
}

export default function Assets({ owned, products, setAmount, onRemove, onOpen, onAsk, onBrowse }: Props) {
  const ids = Object.keys(owned).filter((id) => products.some((p) => p.id === id));
  const mine = ids.map((id) => products.find((p) => p.id === id)!) as Product[];
  return (
    <section>
      <div className="welcome">
        <div className="eyebrow">MY PIECES</div>
        <h1>내 조각자산</h1>
        <p>보유 상품을 등록하고, 발행사의 공시를 한곳에서 확인하세요.</p>
      </div>
      <div className="panel">
        <div className="panel-title">
          등록한 자산 <span className="muted">{ids.length}개</span>
        </div>
        {ids.length > 0 && <Portfolio owned={owned} products={products} />}
        <div style={{ marginTop: 10 }}>
          {mine.map((p) => (
            <div className="asset-card" key={p.id}>
              <div className="type-icon">{p.icon}</div>
              <div className="grow">
                <h3>
                  <button className="link" style={{ color: 'var(--ink)', fontSize: 13 }} onClick={() => onOpen(p.id)}>
                    {p.name}
                  </button>
                </h3>
                <p>
                  {p.assetType} · {p.source === 'dart' ? p.issuer : '가상 자산'} ·{' '}
                  <button className="link" style={{ fontSize: 11, color: '#a3afa6' }} onClick={() => onRemove(p.id)}>
                    삭제
                  </button>
                </p>
              </div>
              <input
                className="amount-input"
                inputMode="numeric"
                aria-label={`${p.name} 투자 금액`}
                placeholder="투자 금액"
                value={owned[p.id] ? owned[p.id].toLocaleString('ko-KR') : ''}
                onChange={(e) => setAmount(p.id, Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
              />
            </div>
          ))}
        </div>
        {ids.length === 0 && <p className="muted">아직 등록한 자산이 없어요. 상품 상세 화면에서 ‘내 자산에 등록’을 눌러 보세요.</p>}
        <button className="link" style={{ marginTop: 16 }} onClick={onBrowse}>
          ＋ 상품 둘러보고 등록하기
        </button>
      </div>

      <div className="section-head">
        <div>
          <h2>내 자산 관련 공시</h2>
          <p>DART에 올라온 발행사 공시예요. 변화 요약 브리핑은 다음 단계에서 제공할 예정이에요.</p>
        </div>
      </div>
      {mine.filter((p) => p.dart?.corpCode).length === 0 ? (
        <p className="muted">DART에서 분석한 실제 상품을 등록하면 발행사 공시가 여기에 모여요.</p>
      ) : (
        mine.filter((p) => p.dart?.corpCode).map((p) => <Disclosures key={p.id} p={p} onAsk={onAsk} />)
      )}
    </section>
  );
}
