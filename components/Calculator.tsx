'use client';
import { useMemo, useState } from 'react';
import type { Product } from '@/lib/types';
import { DEFAULT_DEPOSIT_RATE_PCT, DEFAULT_TAX_PCT, SCENARIOS, defaultYears, minInvestment, runScenario, won } from '@/lib/calc';

const num = (s: string, fallback: number) => {
  const v = Number(s.replace(/,/g, ''));
  return Number.isFinite(v) ? v : fallback;
};

export default function Calculator({ p, budget }: { p: Product; budget: number | null }) {
  const min = minInvestment(p) ?? 10000;
  const [amount, setAmount] = useState(String(Math.max(min, budget ?? 300000)));
  const [years, setYears] = useState(String(defaultYears(p)));
  const [dist, setDist] = useState(p.regularDistribution ? '3' : '0');
  const [tax, setTax] = useState(String(DEFAULT_TAX_PCT));
  const [dep, setDep] = useState(String(DEFAULT_DEPOSIT_RATE_PCT));
  const [changes, setChanges] = useState<string[]>(SCENARIOS.map((s) => String(s.valueChangePct)));
  const [sel, setSel] = useState(1);

  const results = useMemo(
    () =>
      SCENARIOS.map((s, i) =>
        runScenario(p, {
          amount: num(amount, 0),
          years: num(years, 1),
          valueChangePct: num(changes[i], s.valueChangePct),
          distributionYieldPct: num(dist, 0),
          taxPct: num(tax, DEFAULT_TAX_PCT),
          depositRatePct: num(dep, DEFAULT_DEPOSIT_RATE_PCT),
        }),
      ),
    [p, amount, years, dist, tax, dep, changes],
  );
  const r = results[sel];

  return (
    <div className="calc">
      <div className="calc-grid">
        <label className="field">
          <span>투자금(원)</span>
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="field">
          <span>보유 기간(년)</span>
          <input inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
        </label>
        <label className="field">
          <span>연 분배율 가정(%)</span>
          <input inputMode="decimal" value={dist} disabled={p.regularDistribution === false} onChange={(e) => setDist(e.target.value)} />
        </label>
        <label className="field">
          <span>세율 가정(%)</span>
          <input inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} />
        </label>
      </div>
      <div className="scen">
        {SCENARIOS.map((s, i) => (
          <div
            key={s.key}
            role="button"
            tabIndex={0}
            aria-pressed={sel === i}
            className="scen-card"
            style={sel === i ? { borderColor: '#70a981', background: '#f7fbf6', cursor: 'pointer' } : { cursor: 'pointer' }}
            onClick={() => setSel(i)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && setSel(i)}
          >
            <div className="s-label">{s.label}</div>
            <div className="s-change">
              자산 가치{' '}
              <input
                aria-label={`${s.label} 시나리오 자산 가치 변화(%)`}
                value={changes[i]}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setChanges(changes.map((c, j) => (j === i ? e.target.value : c)))}
                style={{ width: 38, border: '1px solid #e1ece1', borderRadius: 5, fontSize: 10.5, padding: '1px 3px', textAlign: 'right' }}
              />
              %
            </div>
            <div className={`s-net ${results[i].netProfit >= 0 ? 'pos' : 'neg'}`}>{won(results[i].netReceipt)}</div>
            <div className={`s-ret ${results[i].netProfit >= 0 ? 'pos' : 'neg'}`}>
              {results[i].netProfit >= 0 ? '+' : ''}
              {results[i].netReturnPct.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
      <div className="breakdown">
        <b>{SCENARIOS[sel].label} 시나리오 자세히</b>
        <br />
        낸 돈 {won(r.paid)} (매수 수수료 {won(r.buyFee)} 포함)
        <br />
        보유 중 분배금 {won(r.distributions)} · 매각 시 가치 {won(r.saleValue)}
        <br />
        연간 보수 −{won(r.annualFees)} · 매각 수수료 −{won(r.sellFee)} · 성과보수 −{won(r.successFee)} · 세금 −{won(r.tax)}
        <br />
        <strong>세후 실수령액 {won(r.netReceipt)}</strong> ({r.netProfit >= 0 ? '+' : ''}
        {won(r.netProfit)})
        <br />
        같은 돈을 연{' '}
        <input
          aria-label="예금 금리(%)"
          value={dep}
          onChange={(e) => setDep(e.target.value)}
          style={{ width: 34, border: '1px solid #dbe8db', borderRadius: 5, fontSize: 11, padding: '1px 3px', textAlign: 'right' }}
        />
        % 예금에 넣으면 세후 {won(r.depositReceipt)} (+{won(r.depositProfit)})
      </div>
      {r.missing.length > 0 && (
        <p className="muted" style={{ marginTop: 8 }}>
          문서에서 확인하지 못한 {r.missing.join('·')}는 0으로 계산했어요. 실제 비용은 더 클 수 있어요.
        </p>
      )}
      <p className="muted" style={{ marginTop: 6 }}>
        시나리오의 자산 가치 변화는 예측이 아니라 직접 바꿔 보는 가정이에요. 세율은 분배·매각 이익을 배당소득(15.4%)으로 본 가정이며, 실제 과세는 상품과 개인 상황에 따라 달라요.
      </p>
    </div>
  );
}
