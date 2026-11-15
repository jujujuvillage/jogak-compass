// 캐시·요청 제한·공유 라이브러리 저장소.
// Upstash Redis 환경변수가 있으면 Redis를, 없으면 서버 메모리를 쓴다.
import { Redis } from '@upstash/redis';

let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

export const hasRedis = () => getRedis() !== null;

const mem = new Map<string, { v: unknown; exp: number }>();
const memLists = new Map<string, string[]>();

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (r) {
    try {
      return ((await r.get<T>(key)) ?? null) as T | null;
    } catch (e) {
      console.error('redis get failed', e);
    }
  }
  const hit = mem.get(key);
  if (!hit) return null;
  if (hit.exp < Date.now()) {
    mem.delete(key);
    return null;
  }
  return hit.v as T;
}

export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      await r.set(key, value, { ex: ttlSec });
      return;
    } catch (e) {
      console.error('redis set failed', e);
    }
  }
  if (mem.size > 500) mem.delete(mem.keys().next().value as string);
  mem.set(key, { v: value, exp: Date.now() + ttlSec * 1000 });
}

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; remaining: number }> {
  const bucket = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  const r = getRedis();
  let count: number;
  if (r) {
    try {
      count = await r.incr(bucket);
      if (count === 1) await r.expire(bucket, windowSec);
      return { ok: count <= limit, remaining: Math.max(0, limit - count) };
    } catch (e) {
      console.error('redis ratelimit failed', e);
    }
  }
  const hit = mem.get(bucket);
  count = ((hit?.v as number) ?? 0) + 1;
  mem.set(bucket, { v: count, exp: Date.now() + windowSec * 1000 });
  return { ok: count <= limit, remaining: Math.max(0, limit - count) };
}

/** 최근 항목을 앞에 넣고 max개만 남긴다(중복 제거). */
export async function listPushUnique(key: string, value: string, max: number): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      await r.lrem(key, 0, value);
      await r.lpush(key, value);
      await r.ltrim(key, 0, max - 1);
      return;
    } catch (e) {
      console.error('redis list failed', e);
    }
  }
  const list = (memLists.get(key) ?? []).filter((v) => v !== value);
  list.unshift(value);
  memLists.set(key, list.slice(0, max));
}

export async function listGet(key: string, n: number): Promise<string[]> {
  const r = getRedis();
  if (r) {
    try {
      return (await r.lrange<string>(key, 0, n - 1)).map(String);
    } catch (e) {
      console.error('redis lrange failed', e);
    }
  }
  return (memLists.get(key) ?? []).slice(0, n);
}

export function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  return (xf?.split(',')[0] || req.headers.get('x-real-ip') || 'local').trim();
}

export function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
