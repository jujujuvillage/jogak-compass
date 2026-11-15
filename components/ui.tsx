'use client';
import { useState } from 'react';
import type { Evidence, Product, TextField } from '@/lib/types';
import { minInvestment, monthsLabel, pct, won } from '@/lib/calc';

export function EvidenceBadge({ ev, found = true }: { ev: Evidence | null; found?: boolean }) {
  if (!found) return <span className="ev-badge none">문서에서 확인 불가</span>;
  if (!ev) return <span className="ev-badge none">근거 없음</span>;
  return ev.verified ? <span className="ev-badge ok">✓ 원문 대조됨</span> : <span className="ev-badge warn">! 원문 확인 필요</span>;
}

export function EvidenceToggle({ ev, onOpen }: { ev: Evidence | null; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  if (!ev) return null;
  return (
    <>
      <button
        className="ev-btn"
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
        aria-expanded={open}
      >
        {open ? '근거 접기 ▲' : '원문 근거 보기 ▼'}
      </button>
      {open && (
        <div className="quote">
          <span className="src">
            {ev.section} · {ev.verified ? '원문에서 같은 문장을 찾았어요' : '원문과 정확히 일치하지 않아요. 공시 원문에서 직접 확인해 주세요'}
          </span>
          “{ev.quote}”
        </div>
      )}
    </>
  );
}

export function SummaryCard({ label, field, onEvidence }: { label: string; field: TextField; onEvidence?: () => void }) {
  return (
    <div className="sum-card">
      <div className="panel-title" style={{ fontSize: 11 }}>
        <span className="label">{label}</span>
        <EvidenceBadge ev={field.evidence} found={field.found} />
      </div>
      <div className={`val${field.found ? '' : ' none'}`}>{field.value}</div>
      <EvidenceToggle ev={field.evidence} onOpen={onEvidence} />
    </div>
  );
}

export function SourcePill({ p }: { p: Product }) {
  return p.source === 'dart' ? <span className="pill real">{p.assetType} · DART 공시</span> : <span className="pill sample">{p.assetType} · 가상 예시</span>;
}

export function ProductCard({ p, onOpen }: { p: Product; onOpen: () => void }) {
  const min = minInvestment(p);
  const n = p.numbers;
  return (
    <button className="product" onClick={onOpen}>
      <div className="product-top">
        <div className="type-icon">{p.icon}</div>
        <SourcePill p={p} />
      </div>
      <h3>{p.name}</h3>
      <p className="desc">{p.oneLine || p.underlying}</p>
      <div className="price-line">
        {min !== null ? `${won(min)}부터` : '최소 투자금 확인 불가'}
        {min !== null && <small>1증권 {won(n.pricePerUnit.value)}</small>}
      </div>
      <dl>
        <div>
          <dt>돈 받는 방식</dt>
          <dd>{p.regularDistribution === true ? '보유 중 정기 분배' : p.regularDistribution === false ? '매각 후 한 번에 정산' : '확인 불가'}</dd>
        </div>
        <div>
          <dt>묶이는 기간</dt>
          <dd>{monthsLabel(n.holdingMonthsMin.value, n.holdingMonthsMax.value)}</dd>
        </div>
        <div>
          <dt>중도 매도</dt>
          <dd>{p.secondaryMarket === '확인불가' ? '확인 불가' : p.secondaryMarket}</dd>
        </div>
        <div>
          <dt>매수 수수료</dt>
          <dd>{pct(n.buyFeePct.value)}</dd>
        </div>
      </dl>
      <div className="row-bottom">
        <span className="small">{p.source === 'dart' ? `${p.issuer} · 수익 비보장` : '가상 데이터 · 수익 비보장'}</span>
        <span className="link">자세히 보기 ↗</span>
      </div>
    </button>
  );
}

export function Footer() {
  return (
    <div className="footer">
      조각나침반은 증권신고서 등 공시 내용을 AI가 정리해 보여주는 정보 서비스이며, 투자 권유·자문·중개를 하지 않아요. AI 정리에는 오류가 있을 수 있으니
      투자 전 반드시 <a href="https://dart.fss.or.kr" target="_blank" rel="noreferrer">DART 공시 원문</a>과 투자설명서를 확인해 주세요. 실수익 계산은 입력한
      가정에 따른 예시이며 실제 결과와 다를 수 있어요. 투자 결정과 그 결과는 투자자 본인에게 있어요.
    </div>
  );
}
