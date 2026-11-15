// GET /api/filings          → 투자계약증권 증권신고서 목록
// GET /api/filings?q=회사명  → 해당 회사의 발행공시(증권신고서·투자설명서)
// GET /api/filings?q=DART링크 또는 접수번호 → 그 공시 한 건
import { filingByRceptNo, filingsByCompanyName, investmentContractFilings } from '@/lib/dart';
import { errorResponse, json, parseRceptInput } from '@/lib/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 200);
    if (!q) {
      const filings = await investmentContractFilings();
      return json({ filings }, 200, { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' });
    }
    const rcept = parseRceptInput(q);
    if (rcept) {
      const f = await filingByRceptNo(rcept);
      return json({ filings: f ? [f] : [], corps: [] });
    }
    const { corps, filings } = await filingsByCompanyName(q);
    return json({ filings, corps: corps.map((c) => c.name) });
  } catch (e) {
    return errorResponse(e);
  }
}
