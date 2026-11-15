// GET /api/health → 서버 설정 상태(키 값은 절대 내보내지 않음)
import { json } from '@/lib/http';
import { model } from '@/lib/openai';
import { hasRedis } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return json({
    ok: true,
    openai: !!process.env.OPENAI_API_KEY,
    dart: !!process.env.DART_API_KEY,
    redis: hasRedis(),
    model: model(),
  });
}
