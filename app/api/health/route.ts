// GET /api/health → 서버 설정 상태. 키 값은 절대 내보내지 않고, 형식(길이·접두어)만 점검한다.
import { json } from '@/lib/http';
import { model } from '@/lib/openai';
import { hasRedis } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (v?: string) => (v ?? '').trim().replace(/^["']|["']$/g, '');

export function GET() {
  const o = clean(process.env.OPENAI_API_KEY);
  const d = clean(process.env.DART_API_KEY);
  return json({
    ok: true,
    openai: !!o,
    dart: !!d,
    redis: hasRedis(),
    model: model(),
    check: {
      openaiStartsWithSk: o.startsWith('sk-'),
      openaiLength: o.length,
      openaiHasSpaces: /\s/.test(o),
      dartLength: d.length,
      dartIs40Alnum: /^[0-9a-zA-Z]{40}$/.test(d),
      dartHasSpaces: /\s/.test(d),
    },
  });
}
