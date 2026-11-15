'use client';
// 브라우저 전용: localStorage 상태 훅과 서버 API 호출.
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, Filing, Product, UserProfile } from './types';

export function useStored<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* 저장소를 못 쓰는 환경이면 메모리로만 동작 */
    }
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 무시 */
    }
  }, [key, value, ready]);
  return [value, setValue, ready];
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error('네트워크에 연결할 수 없어요.');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

export const api = {
  health: () => req<{ openai: boolean; dart: boolean; redis: boolean; model: string }>('/api/health'),
  filings: (q = '') => req<{ filings: Filing[]; corps?: string[] }>(`/api/filings${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  analyze: (filing: Filing) =>
    req<{ product: Product; cached: boolean }>('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rceptNo: filing.rceptNo, filing }),
    }),
  library: () => req<{ products: Product[] }>('/api/library'),
  disclosures: (corpCode: string) => req<{ filings: Filing[] }>(`/api/disclosures?corpCode=${corpCode}`),
  chat: (question: string, product: Product | null, history: ChatMessage[]) =>
    req<{ answer: string }>('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, product, history }),
    }),
};

export const DEFAULT_PROFILE: UserProfile = {
  needMoneyInMonths: null,
  purpose: null,
  mayNeedEarlyExit: true,
  canAcceptLoss: false,
  interests: [],
  monthlyBudget: null,
};

export const fmtDate = (ymd: string) => (ymd?.length === 8 ? `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6)}` : ymd);
