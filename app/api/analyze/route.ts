// POST /api/analyze { rceptNo } → 상품 구조 카드(Product). 결과는 30일 캐시하고 공유 라이브러리에 올린다.
import { fetchDocumentSections, filingByRceptNo } from '@/lib/dart';
import { extractProduct } from '@/lib/extract';
import { errorResponse, isRceptNo, json } from '@/lib/http';
import { cacheGet, cacheSet, clientIp, envInt, listPushUnique, rateLimit } from '@/lib/store';
import type { Filing, Product } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const inflight = new Map<string, Promise<Product>>();

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { rceptNo?: unknown; filing?: Partial<Filing> };
    if (!isRceptNo(body.rceptNo)) return json({ error: '접수번호(14자리)가 올바르지 않아요.' }, 400);
    const rceptNo = body.rceptNo;
    const cacheKey = `analysis:v1:${rceptNo}`;

    const cached = await cacheGet<Product>(cacheKey);
    if (cached) return json({ product: cached, cached: true });

    const rl = await rateLimit(`analyze:${clientIp(req)}`, envInt('RATE_LIMIT_ANALYZE_PER_DAY', 15), 24 * 3600);
    if (!rl.ok) return json({ error: '오늘 분석할 수 있는 횟수를 모두 썼어요. 이미 분석된 상품은 계속 볼 수 있어요.' }, 429);

    let job = inflight.get(rceptNo);
    if (!job) {
      job = (async () => {
        const f = body.filing;
        const filing: Filing =
          f && f.rceptNo === rceptNo && f.corpName && f.reportName && f.corpCode && f.receivedAt
            ? { rceptNo, corpCode: String(f.corpCode), corpName: String(f.corpName), reportName: String(f.reportName), receivedAt: String(f.receivedAt), url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}` }
            : ((await filingByRceptNo(rceptNo)) ?? { rceptNo, corpCode: '', corpName: '확인 불가', reportName: '공시 문서', receivedAt: rceptNo.slice(0, 8), url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}` });
        const sections = await fetchDocumentSections(rceptNo);
        const product = await extractProduct(filing, sections);
        await cacheSet(cacheKey, product, 30 * 24 * 3600);
        await listPushUnique('library:v1', rceptNo, 200);
        return product;
      })().finally(() => inflight.delete(rceptNo));
      inflight.set(rceptNo, job);
    }
    const product = await job;
    return json({ product, cached: false });
  } catch (e) {
    return errorResponse(e);
  }
}

// GET /api/analyze?rceptNo= → 캐시된 분석 결과만 조회(새로 분석하지 않음)
export async function GET(req: Request) {
  const rceptNo = new URL(req.url).searchParams.get('rceptNo');
  if (!isRceptNo(rceptNo)) return json({ error: '접수번호가 올바르지 않아요.' }, 400);
  const product = await cacheGet<Product>(`analysis:v1:${rceptNo}`);
  return product ? json({ product }) : json({ product: null }, 404);
}
