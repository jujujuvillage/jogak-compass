'use client';
import { useEffect } from 'react';
import type { NumberField, Product, UserProfile } from '@/lib/types';
import { checkFit } from '@/lib/fit';
import { minInvestment, monthsLabel, pct, won } from '@/lib/calc';
import { fmtDate } from '@/lib/client';
import Calculator from './Calculator';
import { EvidenceBadge, EvidenceToggle, SourcePill, SummaryCard } from './ui';

interface Props {
  p: Product;
  profile: UserProfile;
  owned: boolean;
  inCompare: boolean;
  onClose: () => void;
  onToggleOwned: () => void;
  onToggleCompare: () => void;
  onAsk: (q: string) => void;
  onEditProfile: () => void;
  onEvidence: () => void;
}

const MARK: Record<string, string> = { ok: '✓', warn: '!', mismatch: '✕', unknown: '?' };

function NumRow({ label, f, render, onEvidence }: { label: string; f: NumberField; render: (v: number) => string; onEvidence: () => void }) {
  return (
    <tr>
      <td>
        {label}
        <div>
          <EvidenceToggle ev={f.evidence} onOpen={onEvidence} />
        </div>
      </td>
      <td>
        {f.value === null ? <span className="na">확인 불가</span> : render(f.value)}
        {f.value !== null && f.evidence && (
          <div style={{ marginTop: 4 }}>
            <EvidenceBadge ev={f.evidence} />
          </div>
        )}
      </td>
    </tr>
  );
}

export default function ProductDetail({ p, profile, owned, inCompare, onClose, onToggleOwned, onToggleCompare, onAsk, onEditProfile, onEvidence }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const n = p.numbers;
  const fit = checkFit(p, profile);
  const min = minInvestment(p);

  return (
    <div className="detail" onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={`${p.name} 상세`}>
      <div className="drawer">
        <div className="drawer-top">
          <span className="eyebrow">PRODUCT · 상품 구조 한 장 요약</span>
          <button className="close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <SourcePill p={p} />
        <h2>
          {p.icon} {p.name}
        </h2>
        <p className="meta">
          {p.issuer}
          {p.dart && (
            <>
              {' · '}
              {p.dart.reportName} ({fmtDate(p.dart.receivedAt)})
              <br />
              <a href={p.dart.url} target="_blank" rel="noreferrer" onClick={onEvidence}>
                DART 공시 원문 보기 ↗
              </a>
              {typeof p.verifiedRatio === 'number' && <span className="muted"> · 근거 원문 대조율 {Math.round(p.verifiedRatio * 100)}%</span>}
            </>
          )}
        </p>
        {p.source === 'sample' && <div className="notice" style={{ marginBottom: 12 }}>화면 구조를 보여주는 가상 예시 상품이에요. 실제 상품이 아니에요.</div>}
        <div className="callout">{p.oneLine}</div>

        <div className="summary-grid">
          <SummaryCard label="💰 돈 버는 방식" field={p.howToEarn} onEvidence={onEvidence} />
          <SummaryCard label="⏳ 돈이 묶이는 기간" field={p.lockup} onEvidence={onEvidence} />
          <SummaryCard label="↩ 돌려받는 방법" field={p.howToExit} onEvidence={onEvidence} />
          <div className="sum-card">
            <span className="label">⚠ 주요 위험</span>
            {p.risks.length === 0 && <div className="val none">문서에서 확인 불가</div>}
            {p.risks.map((r, i) => (
              <div key={i} style={{ marginTop: 10 }}>
                <div className="val" style={{ marginTop: 0 }}>
                  <b>{r.title}</b> — {r.explanation}
                </div>
                <EvidenceToggle ev={r.evidence} onOpen={onEvidence} />
              </div>
            ))}
          </div>
        </div>

        <div className="block" style={{ marginTop: 16 }}>
          <b>수수료와 분배</b>
          <SummaryCard label="수수료" field={p.fees} onEvidence={onEvidence} />
          <div style={{ height: 8 }} />
          <SummaryCard label="분배(수익 지급)" field={p.distribution} onEvidence={onEvidence} />
          <table className="num-table">
            <tbody>
              <tr>
                <td>최소 투자금</td>
                <td>{min === null ? <span className="na">확인 불가</span> : won(min)}</td>
              </tr>
              <NumRow label="1증권 가격" f={n.pricePerUnit} render={won} onEvidence={onEvidence} />
              <NumRow label="최소 청약 수량" f={n.minUnits} render={(v) => `${v.toLocaleString('ko-KR')}증권`} onEvidence={onEvidence} />
              <NumRow label="모집 총액" f={n.offeringAmount} render={won} onEvidence={onEvidence} />
              <tr>
                <td>예상 보유 기간</td>
                <td>{monthsLabel(n.holdingMonthsMin.value, n.holdingMonthsMax.value)}</td>
              </tr>
              <tr>
                <td>
                  중도 매도
                  <div>
                    <EvidenceToggle ev={p.secondaryMarketEvidence} onOpen={onEvidence} />
                  </div>
                </td>
                <td>{p.secondaryMarket === '확인불가' ? <span className="na">확인 불가</span> : p.secondaryMarket}</td>
              </tr>
              <NumRow label="매수 수수료" f={n.buyFeePct} render={(v) => pct(v, 2)} onEvidence={onEvidence} />
              <NumRow label="매각 수수료" f={n.sellFeePct} render={(v) => pct(v, 2)} onEvidence={onEvidence} />
              <NumRow label="연간 보수" f={n.annualFeePct} render={(v) => `${pct(v, 2)}/년`} onEvidence={onEvidence} />
              <NumRow label="성과보수" f={n.successFeePct} render={(v) => `이익의 ${pct(v, 1)}`} onEvidence={onEvidence} />
            </tbody>
          </table>
        </div>

        <div className="block">
          <div className="block-title">
            나와 맞는지 체크
            <button className="link" onClick={onEditProfile}>
              기준 수정 →
            </button>
          </div>
          <p>매수를 추천하지 않아요. 내 조건과 상품 조건이 어긋나는 곳만 표시해요.</p>
          {fit.map((f, i) => (
            <div className="fit-item" key={i}>
              <span className={`fit-mark fit-${f.level}`}>{MARK[f.level]}</span>
              <div>
                <b>{f.title}</b>
                <br />
                <span style={{ color: '#5f7166' }}>{f.detail}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="block">
          <b>실수익 계산기</b>
          <p>수수료와 세금을 뺀 실수령액을 시나리오별로 계산하고 예금과 비교해요. 숫자는 코드로 계산해요.</p>
          <Calculator p={p} budget={profile.monthlyBudget} />
        </div>

        {p.unknowns.length > 0 && (
          <div className="block">
            <b>문서에서 확인하지 못한 것</b>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#5f7166', fontSize: 12.5, lineHeight: 1.8 }}>
              {p.unknowns.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="drawer-actions">
          <button className={inCompare ? 'secondary' : 'primary'} onClick={onToggleCompare}>
            {inCompare ? '비교에서 빼기' : '＋ 비교에 담기'}
          </button>
          <button className="secondary" onClick={onToggleOwned}>
            {owned ? '내 자산에서 빼기' : '내 자산에 등록'}
          </button>
        </div>
        <button className="secondary full" style={{ marginTop: 8 }} onClick={() => onAsk(`${p.name}의 투자금은 언제, 어떻게 돌려받나요?`)}>
          ✦ 이 상품에 대해 에이전트에게 질문하기
        </button>
        {p.analyzedAt && (
          <p className="disclaimer">
            AI 정리: {new Date(p.analyzedAt).toLocaleDateString('ko-KR')} · {p.model}. AI가 읽고 정리한 내용이라 오류가 있을 수 있어요. ‘원문 확인 필요’ 표시가 있는 항목은
            꼭 원문에서 확인해 주세요.
          </p>
        )}
      </div>
    </div>
  );
}
