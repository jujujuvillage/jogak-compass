import { DartError } from './dart';
import { LlmError } from './openai';

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

export function errorResponse(e: unknown) {
  if (e instanceof DartError || e instanceof LlmError) return json({ error: e.message }, e.status);
  console.error(e);
  return json({ error: '일시적인 오류가 났어요. 잠시 후 다시 시도해 주세요.' }, 500);
}

export const isRceptNo = (s: unknown): s is string => typeof s === 'string' && /^\d{14}$/.test(s);

/** DART 링크(rcpNo=...)나 14자리 접수번호를 받아 접수번호만 꺼낸다. */
export function parseRceptInput(s: string): string | null {
  const m = s.match(/rcpNo=(\d{14})/i) ?? s.match(/\b(\d{14})\b/);
  return m ? m[1] : null;
}
