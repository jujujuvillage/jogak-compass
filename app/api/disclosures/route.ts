// GET /api/disclosures?corpCode=XXXXXXXX → 발행사의 최근 1년 공시(내 조각자산 화면용)
import { recentDisclosures } from '@/lib/dart';
import { errorResponse, json } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const corpCode = new URL(req.url).searchParams.get('corpCode') ?? '';
    if (!/^\d{8}$/.test(corpCode)) return json({ error: '회사 고유번호가 올바르지 않아요.' }, 400);
    const filings = await recentDisclosures(corpCode);
    return json({ filings }, 200, { 'Cache-Control': 's-maxage=900, stale-while-revalidate=3600' });
  } catch (e) {
    return errorResponse(e);
  }
}
