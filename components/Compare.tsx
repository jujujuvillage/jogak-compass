'use client';
import { useState } from 'react';
import type { Product, UserProfile } from '@/lib/types';
import { holdingCost, minInvestment, monthsLabel, pct, won } from '@/lib/calc';
import { checkFit } from '@/lib/fit';

interface Props {
  products: Product[];
  selected: string[];
  onToggle: (id: string) => void;
  profile: UserProfile;
  onOpen: (id: string) => void;
  onEditProfile: () => void;
}

const NA = <span className="na">확인 불가</span>;

export default function Compare({ products, selected, onToggle, profile, onOpen, onEditProfile }: Props) {
  const [years, setYears] = useState(2);
  const [amount, setAmount] = useState('1000000');
  const amt = Math.max(0, Number(amount.replace(/,/g, '')) || 0);
  const chosen = selected.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[];

  const rows: { label: string; cell: (p: Product) => React.ReactNode; hl?: boolean }[] = [
    { label: '자산·출처', cell: (p) => `${p.assetType} · ${p.source === 'dart' ? 'DART 공시' : '가상'}` },
    { label: '최소 투자금', cell: (p) => (minInvestment(p) === null ? NA : <strong>{won(minInvestment(p))}</strong>) },
    { label: '돈 버는 방식', cell: (p) => (p.howToEarn.found ? p.howToEarn.value : NA) },
    { label: '돈 받는 시점', cell: (p) => (p.regularDistribution === true ? '보유 중 정기 분배' : p.regularDistribution === false ? '매각 후 한 번에' : NA) },
    { label: '묶이는 기간', cell: (p) => monthsLabel(p.numbers.holdingMonthsMin.value, p.numbers.holdingMonthsMax.value) },
    { label: '중도 매도', cell: (p) => (p.secondaryMarket === '확인불가' ? NA : p.secondaryMarket) },
    { label: '매수 수수료', cell: (p) => (p.numbers.buyFeePct.value === null ? NA : pct(p.numbers.buyFeePct.value, 2)) },
    { label: '매각 수수료', cell: (p) => (p.numbers.sellFeePct.value === null ? NA : pct(p.numbers.sellFeePct.value, 2)) },
    { label: '연간 보수', cell: (p) => (p.numbers.annualFeePct.value === null ? NA : `${pct(p.numbers.annualFeePct.value, 2)}/년`) },
    { label: '성과보수', cell: (p) => (p.numbers.successFeePct.value === null ? NA : `이익의 ${pct(p.numbers.successFeePct.value)}`) },
    {
      label: `${years}년 보유 시 총비용`,
      hl: true,
      cell: (p) => {
        const c = holdingCost(p, amt, years);
        return (
          <>
            <strong>{won(c.total)}</strong>
            <br />
            <span className="muted">투자금의 {c.totalPct.toFixed(2)}%</span>
            {c.missing.length > 0 && (
              <>
                <br />
                <span className="muted">{c.missing.join('·')} 확인 불가(0으로 계산)</span>
              </>
            )}
          </>
        );
      },
    },
    { label: '주요 위험', cell: (p) => (p.risks.length ? p.risks.slice(0, 3).map((r) => r.title).join(', ') : NA) },
    {
      label: '나와 어긋나는 점',
      cell: (p) => {
        const mm = checkFit(p, profile).filter((f) => f.level === 'mismatch');
        return mm.length ? <span style={{ color: 'var(--red-ink)' }}>{mm.map((f) => f.title).join(', ')}</span> : '없음';
      },
    },
  ];

  return (
    <section>
      <div className="welcome">
        <div className="eyebrow">COMPARE</div>
        <h1>상품 비교하기</h1>
        <p>수익보다 먼저, 돈이 움직이는 방식을 같은 기준으로 살펴보세요.</p>
      </div>
      <div className="panel">
        <div className="panel-title">비교할 상품 (2~4개)</div>
        <div className="chip-row">
          {products.map((p) => (
            <button key={p.id} className={`chip${selected.includes(p.id) ? ' on' : ''}`} onClick={() => onToggle(p.id)}>
              {p.icon} {p.name}
              {p.source === 'sample' ? ' (가상)' : ''}
            </button>
          ))}
        </div>
        <div className="calc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="field">
            <span>투자금 가정(원)</span>
            <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="field">
            <span>보유 기간</span>
            <select value={years} onChange={(e) => setYears(Number(e.target.value))}>
              {[1, 2, 3, 5].map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="panel">
        {chosen.length < 2 ? (
          <p className="muted">위에서 상품을 2개 이상 골라 주세요. 상품 상세 화면의 ‘비교에 담기’로도 추가할 수 있어요.</p>
        ) : (
          <div className="compare-wrap">
            <table className="compare-table" style={{ minWidth: 90 + chosen.length * 120 }}>
              <thead>
                <tr>
                  <th>항목</th>
                  {chosen.map((p) => (
                    <th key={p.id}>
                      <button className="link" style={{ textAlign: 'left', fontSize: 12 }} onClick={() => onOpen(p.id)}>
                        {p.icon} {p.name} ↗
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className={r.hl ? 'hl' : undefined}>
                    <td>{r.label}</td>
                    {chosen.map((p) => (
                      <td key={p.id}>{r.cell(p)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="disclaimer">
          총비용은 자산 가치가 그대로라고 가정하고 매수 수수료 + 연간 보수×기간 + 매각 수수료를 코드로 더한 값이에요(성과보수는 이익이 생길 때만 붙어 제외). 세금과 문서에
          없는 비용은 빠져 있어요. 어긋나는 점은{' '}
          <button className="link" onClick={onEditProfile}>
            나의 투자 기준
          </button>
          을 바탕으로 표시해요.
        </p>
      </div>
    </section>
  );
}
