// GET /api/library → 지금까지 분석된 실제 상품(공유 아카이브)
import { json } from '@/lib/http';
import { cacheGet, listGet } from '@/lib/store';
import type { Product } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ids = await listGet('library:v1', 40);
  const products = (await Promise.all(ids.map((id) => cacheGet<Product>(`analysis:v1:${id}`)))).filter(Boolean) as Product[];
  return json({ products }, 200, { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' });
}
