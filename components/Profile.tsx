'use client';
import { useState } from 'react';
import type { UserProfile } from '@/lib/types';

interface Props {
  profile: UserProfile;
  onSave: (p: UserProfile) => void;
}

const WHEN: { label: string; sub: string; v: number | null }[] = [
  { label: '1년 이내', sub: '가까운 시기에 필요해요', v: 12 },
  { label: '1~2년', sub: '목돈 쓸 계획이 있어요', v: 24 },
  { label: '3~5년', sub: '여유 있게 생각해요', v: 60 },
  { label: '정하지 않음', sub: '아직 잘 모르겠어요', v: null },
];
const PURPOSE: { label: string; sub: string; v: UserProfile['purpose'] }[] = [
  { label: '정기적인 수익', sub: '보유하는 동안 꾸준히', v: '정기수익' },
  { label: '목돈 불리기', sub: '나중에 한 번에', v: '목돈' },
  { label: '경험·공부', sub: '소액으로 배우기', v: '경험' },
];
const INTERESTS = ['투자금 회수', '정기적인 수익', '비용과 수수료', '자산의 위험'];

export default function Profile({ profile, onSave }: Props) {
  const [p, setP] = useState<UserProfile>(profile);
  const set = (patch: Partial<UserProfile>) => setP({ ...p, ...patch });

  return (
    <section>
      <div className="welcome">
        <div className="eyebrow">YOUR PREFERENCES</div>
        <h1>나의 투자 기준</h1>
        <p>입력한 기준으로 상품 조건과 어긋나는 점을 표시해요. 이 정보는 이 브라우저에만 저장돼요.</p>
      </div>
      <div className="panel">
        <h3 className="q-title">투자한 돈이 언제 필요할 수 있나요?</h3>
        <p className="muted">정확한 날짜가 아니어도 괜찮아요.</p>
        <div className="options">
          {WHEN.map((w) => (
            <button key={w.label} className={`option${p.needMoneyInMonths === w.v ? ' selected' : ''}`} onClick={() => set({ needMoneyInMonths: w.v })}>
              <b>{w.label}</b>
              {w.sub}
            </button>
          ))}
        </div>

        <h3 className="q-title">투자 목적은 무엇에 가까운가요?</h3>
        <div className="options">
          {PURPOSE.map((w) => (
            <button key={w.label} className={`option${p.purpose === w.v ? ' selected' : ''}`} onClick={() => set({ purpose: w.v })}>
              <b>{w.label}</b>
              {w.sub}
            </button>
          ))}
        </div>

        <h3 className="q-title">중간에 돈을 꺼내야 할 수도 있나요?</h3>
        <div className="options">
          <button className={`option${p.mayNeedEarlyExit ? ' selected' : ''}`} onClick={() => set({ mayNeedEarlyExit: true })}>
            <b>그럴 수 있어요</b>급한 일이 생길 수 있어요
          </button>
          <button className={`option${!p.mayNeedEarlyExit ? ' selected' : ''}`} onClick={() => set({ mayNeedEarlyExit: false })}>
            <b>끝까지 둘 수 있어요</b>묶여도 괜찮아요
          </button>
        </div>

        <h3 className="q-title">원금이 줄어들 수 있어도 괜찮나요?</h3>
        <div className="options">
          <button className={`option${p.canAcceptLoss ? ' selected' : ''}`} onClick={() => set({ canAcceptLoss: true })}>
            <b>감수할 수 있어요</b>손실 가능성을 알아요
          </button>
          <button className={`option${!p.canAcceptLoss ? ' selected' : ''}`} onClick={() => set({ canAcceptLoss: false })}>
            <b>원금은 지키고 싶어요</b>손실은 피하고 싶어요
          </button>
        </div>

        <h3 className="q-title">한 번에(또는 매달) 넣을 수 있는 금액</h3>
        <label className="field">
          <input
            inputMode="numeric"
            placeholder="예: 300000"
            value={p.monthlyBudget ?? ''}
            onChange={(e) => {
              const v = Number(e.target.value.replace(/[^\d]/g, ''));
              set({ monthlyBudget: v > 0 ? v : null });
            }}
          />
        </label>

        <h3 className="q-title">어떤 점이 가장 궁금한가요?</h3>
        <div className="filters">
          {INTERESTS.map((i) => (
            <button
              key={i}
              className={`filter${p.interests.includes(i) ? ' active' : ''}`}
              onClick={() => set({ interests: p.interests.includes(i) ? p.interests.filter((x) => x !== i) : [...p.interests, i] })}
            >
              {i}
            </button>
          ))}
        </div>
        <button className="primary full" onClick={() => onSave(p)}>
          기준 저장하기
        </button>
        <p className="disclaimer">투자성향 진단이 아니에요. 상품 조건과 비교하기 위한 참고용이며, 서버에 저장하지 않아요.</p>
      </div>
    </section>
  );
}
