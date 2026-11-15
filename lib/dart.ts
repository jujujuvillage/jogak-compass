// DART 오픈API 호출. 키는 서버에서만 쓰고 브라우저로 보내지 않는다.
import { unzipSync } from 'fflate';
import type { Filing } from './types';
import { cacheGet, cacheSet } from './store';
import { parseDartZip, type Section } from './docparse';

const BASE = 'https://opendart.fss.or.kr/api';

export class DartError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

function key(): string {
  const k = process.env.DART_API_KEY;
  if (!k) throw new DartError('서버에 DART_API_KEY가 설정되지 않았어요.', 500);
  return k;
}

const DART_STATUS: Record<string, string> = {
  '010': 'DART 인증키가 등록되지 않았어요.',
  '011': 'DART 인증키 사용이 제한됐어요.',
  '012': '접근할 수 없는 IP예요.',
  '014': '파일이 존재하지 않아요.',
  '020': 'DART 요청 한도를 넘었어요. 잠시 후 다시 시도해 주세요.',
  '021': '조회 가능한 회사 수를 넘었어요.',
  '100': '요청 값이 올바르지 않아요.',
  '101': '부적절한 접근이에요.',
  '800': 'DART 시스템 점검 중이에요.',
  '900': 'DART에서 정의되지 않은 오류가 났어요.',
  '901': 'DART 인증키 기간이 만료됐어요.',
};

export const ymd = (d: Date) => {
  const k = new Date(d.getTime() + 9 * 3600 * 1000); // KST
  return k.toISOString().slice(0, 10).replace(/-/g, '');
};

export const dartViewerUrl = (rceptNo: string) => `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`;

interface ListItem {
  corp_code: string;
  corp_name: string;
  report_nm: string;
  rcept_no: string;
  rcept_dt: string;
}

async function listJson(params: Record<string, string>): Promise<{ items: ListItem[]; totalPage: number }> {
  const qs = new URLSearchParams({ crtfc_key: key(), page_count: '100', ...params });
  const res = await fetch(`${BASE}/list.json?${qs}`, { cache: 'no-store' });
  if (!res.ok) throw new DartError(`DART 응답 오류 (${res.status})`);
  const j = (await res.json()) as { status: string; message: string; list?: ListItem[]; total_page?: number };
  if (j.status === '013') return { items: [], totalPage: 0 };
  if (j.status !== '000') throw new DartError(DART_STATUS[j.status] ?? `DART 오류: ${j.message}`);
  return { items: j.list ?? [], totalPage: j.total_page ?? 1 };
}

const toFiling = (x: ListItem): Filing => ({
  rceptNo: x.rcept_no,
  corpCode: x.corp_code,
  corpName: x.corp_name,
  reportName: x.report_nm.replace(/\s+/g, ' ').trim(),
  receivedAt: x.rcept_dt,
  url: dartViewerUrl(x.rcept_no),
});

// ── 회사 고유번호 ─────────────────────────────────────────
interface Corp {
  code: string;
  name: string;
}
let corpMem: { at: number; list: Corp[] } | null = null;

export async function corpList(): Promise<Corp[]> {
  if (corpMem && Date.now() - corpMem.at < 24 * 3600 * 1000) return corpMem.list;
  const res = await fetch(`${BASE}/corpCode.xml?crtfc_key=${key()}`, { cache: 'no-store' });
  if (!res.ok) throw new DartError(`DART 회사 목록 응답 오류 (${res.status})`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new DartError('DART 회사 목록을 받지 못했어요. 인증키를 확인해 주세요.');
  const files = unzipSync(buf);
  const xml = new TextDecoder('utf-8').decode(Object.values(files)[0]);
  const list: Corp[] = [];
  const re = /<corp_code>(\d{8})<\/corp_code>\s*<corp_name>([^<]*)<\/corp_name>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) list.push({ code: m[1], name: m[2].trim() });
  corpMem = { at: Date.now(), list };
  return list;
}

export async function searchCorps(q: string, limit = 8): Promise<Corp[]> {
  const needle = q.replace(/\s+/g, '').replace(/^\(주\)|주식회사/g, '');
  if (!needle) return [];
  const list = await corpList();
  const exact = list.filter((c) => c.name.replace(/\s+/g, '') === needle);
  const partial = list.filter((c) => c.name.replace(/\s+/g, '').includes(needle) && !exact.includes(c));
  return [...exact, ...partial].slice(0, limit);
}

// ── 투자계약증권 신고서 목록 ─────────────────────────────────
/** 투자계약증권을 발행한 적이 있는 조각투자 사업자(2023년 7월 사업재편 승인 5개사 등). */
export const KNOWN_ISSUERS = ['열매컴퍼니', '투게더아트', '서울옥션블루', '스탁키퍼', '테사'];

const IC_RE = /투자계약/;
const OFFERING_RE = /증권신고서|투자설명서|증권발행실적/;

async function filingsForCorp(corpCode: string, bgnDe = '20230101'): Promise<Filing[]> {
  const out: Filing[] = [];
  for (let page = 1; page <= 5; page++) {
    const { items, totalPage } = await listJson({ corp_code: corpCode, bgn_de: bgnDe, end_de: ymd(new Date()), pblntf_ty: 'C', page_no: String(page) });
    out.push(...items.map(toFiling));
    if (page >= totalPage) break;
  }
  return out;
}

/** 최근 3개월 발행공시 전체를 훑어 '투자계약'이 들어간 보고서를 찾는다(신규 발행사 발견용). */
async function scanRecent(): Promise<Filing[]> {
  const end = new Date();
  const bgn = new Date(end.getTime() - 89 * 24 * 3600 * 1000);
  const out: Filing[] = [];
  for (let page = 1; page <= 40; page++) {
    const { items, totalPage } = await listJson({ bgn_de: ymd(bgn), end_de: ymd(end), pblntf_ty: 'C', page_no: String(page) });
    out.push(...items.filter((x) => IC_RE.test(x.report_nm)).map(toFiling));
    if (page >= totalPage) break;
  }
  return out;
}

function dedupeSort(list: Filing[]): Filing[] {
  const map = new Map<string, Filing>();
  for (const f of list) map.set(f.rceptNo, f);
  return [...map.values()].sort((a, b) => b.rceptNo.localeCompare(a.rceptNo));
}

export async function investmentContractFilings(): Promise<Filing[]> {
  const cacheKey = 'filings:ic:v1';
  const cached = await cacheGet<Filing[]>(cacheKey);
  if (cached) return cached;
  const corps = await corpList();
  const known = KNOWN_ISSUERS.map((n) => corps.find((c) => c.name === n)).filter(Boolean) as Corp[];
  const results = await Promise.allSettled([...known.map((c) => filingsForCorp(c.code)), scanRecent()]);
  const all: Filing[] = [];
  for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);
  if (!all.length && results.every((r) => r.status === 'rejected')) {
    throw (results[0] as PromiseRejectedResult).reason;
  }
  const filtered = dedupeSort(all.filter((f) => IC_RE.test(f.reportName) || (OFFERING_RE.test(f.reportName) && known.some((k) => k.code === f.corpCode))));
  await cacheSet(cacheKey, filtered, 6 * 3600);
  return filtered;
}

export async function filingsByCompanyName(q: string): Promise<{ corps: Corp[]; filings: Filing[] }> {
  const corps = await searchCorps(q, 5);
  const lists = await Promise.allSettled(corps.slice(0, 3).map((c) => filingsForCorp(c.code)));
  const filings: Filing[] = [];
  for (const r of lists) if (r.status === 'fulfilled') filings.push(...r.value.filter((f) => OFFERING_RE.test(f.reportName) || IC_RE.test(f.reportName)));
  return { corps, filings: dedupeSort(filings) };
}

export async function filingByRceptNo(rceptNo: string): Promise<Filing | null> {
  // 접수일은 접수번호 앞 8자리. 그날 하루의 발행공시에서 찾는다.
  const d = rceptNo.slice(0, 8);
  for (let page = 1; page <= 10; page++) {
    const { items, totalPage } = await listJson({ bgn_de: d, end_de: d, page_no: String(page) });
    const hit = items.find((x) => x.rcept_no === rceptNo);
    if (hit) return toFiling(hit);
    if (page >= totalPage) break;
  }
  return null;
}

// ── 원문 ────────────────────────────────────────────────
export async function fetchDocumentSections(rceptNo: string): Promise<Section[]> {
  const cacheKey = `doc:v1:${rceptNo}`;
  const cached = await cacheGet<Section[]>(cacheKey);
  if (cached) return cached;
  const res = await fetch(`${BASE}/document.xml?crtfc_key=${key()}&rcept_no=${rceptNo}`, { cache: 'no-store' });
  if (!res.ok) throw new DartError(`DART 원문 응답 오류 (${res.status})`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
    const text = new TextDecoder('utf-8').decode(buf.slice(0, 500));
    const code = text.match(/<status>(\d+)<\/status>/)?.[1] ?? text.match(/"status"\s*:\s*"(\d+)"/)?.[1];
    throw new DartError(code ? DART_STATUS[code] ?? `DART 오류 (${code})` : 'DART 원문을 받지 못했어요.');
  }
  const sections = parseDartZip(buf);
  if (!sections.length) throw new DartError('원문에서 글자를 읽지 못했어요(이미지 문서일 수 있어요).', 422);
  // 너무 큰 문서는 앞쪽 위주로 잘라 저장(Redis 1MB 제한 대비).
  let total = 0;
  const trimmed: Section[] = [];
  for (const s of sections) {
    if (total > 600000) break;
    const text = s.text.slice(0, 40000);
    trimmed.push({ title: s.title, text });
    total += text.length;
  }
  await cacheSet(cacheKey, trimmed, 7 * 24 * 3600);
  return trimmed;
}

// ── 보유 상품 관련 공시(내 조각자산) ───────────────────────────
export async function recentDisclosures(corpCode: string): Promise<Filing[]> {
  const cacheKey = `disc:v1:${corpCode}`;
  const cached = await cacheGet<Filing[]>(cacheKey);
  if (cached) return cached;
  const bgn = new Date(Date.now() - 365 * 24 * 3600 * 1000);
  const { items } = await listJson({ corp_code: corpCode, bgn_de: ymd(bgn), end_de: ymd(new Date()), page_count: '30' });
  const list = items.map(toFiling);
  await cacheSet(cacheKey, list, 3600);
  return list;
}
