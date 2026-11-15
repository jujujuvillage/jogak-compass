// DART 원문(document.xml이 돌려주는 zip 안의 XML)을 섹션별 텍스트로 바꾸고, 인용문을 원문과 대조한다.
import { unzipSync } from 'fflate';
import iconv from 'iconv-lite';

export interface Section {
  title: string;
  text: string;
}

function decodeXml(buf: Uint8Array): string {
  const head = new TextDecoder('ascii').decode(buf.slice(0, 200)).toLowerCase();
  if (/encoding=["'](euc-kr|ks_c_5601|cp949)/.test(head)) return iconv.decode(Buffer.from(buf), 'euc-kr');
  return new TextDecoder('utf-8').decode(buf);
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const T_START = '\u0001';
const T_END = '\u0002';

export function xmlToSections(xml: string): Section[] {
  let s = xml
    .replace(/<\?xml[^>]*>/gi, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<(IMAGE|IMG|LIBRARY|EXTRACTION)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<TITLE[^>]*>([\s\S]*?)<\/TITLE>/gi, (_m, t: string) => `\n${T_START}${t.replace(/<[^>]+>/g, ' ')}${T_END}\n`)
    .replace(/<\/(TR)>/gi, '\n')
    .replace(/<\/(TD|TH|TE|TU)>/gi, ' | ')
    .replace(/<(BR|P|\/P|SPAN\s+USERMARK="[^"]*")\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  const lines = s
    .split('\n')
    .map((l) => l.replace(/[ \t 　]+/g, ' ').replace(/(\s*\|\s*)+$/g, '').trim())
    .filter((l) => l && l !== '|');
  const sections: Section[] = [];
  let cur: Section = { title: '표지', text: '' };
  for (const line of lines) {
    const m = line.match(new RegExp(`^${T_START}(.*)${T_END}$`));
    if (m) {
      if (cur.text.trim()) sections.push(cur);
      cur = { title: m[1].replace(/\s+/g, ' ').trim() || '제목 없음', text: '' };
    } else {
      cur.text += line.replace(new RegExp(`[${T_START}${T_END}]`, 'g'), '') + '\n';
    }
  }
  if (cur.text.trim()) sections.push(cur);
  return sections;
}

/** DART document.xml 응답(zip)을 섹션 목록으로. 여러 XML이면 순서대로 이어 붙인다. */
export function parseDartZip(buf: Uint8Array): Section[] {
  const files = unzipSync(buf);
  const names = Object.keys(files)
    .filter((n) => /\.xml$/i.test(n))
    .sort();
  const out: Section[] = [];
  for (const name of names) out.push(...xmlToSections(decodeXml(files[name])));
  return out;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s|·•ㆍ,.:;'"“”‘’()\[\]{}<>「」『』\-–—_~*※□■○●▶▷→]/g, '');
}

/** 인용문이 원문에 있는지 확인. 정확히 없으면 12자 조각의 70% 이상이 원문에 있을 때 통과. */
export function verifyQuote(quote: string, normalizedFull: string): boolean {
  const q = normalize(quote);
  if (q.length < 6) return false;
  if (normalizedFull.includes(q)) return true;
  const size = 12;
  const chunks: string[] = [];
  for (let i = 0; i + size <= q.length; i += size) chunks.push(q.slice(i, i + size));
  if (chunks.length < 2) return false;
  const hits = chunks.filter((c) => normalizedFull.includes(c)).length;
  return hits / chunks.length >= 0.7;
}

const KEYWORDS: [RegExp, number][] = [
  [/수수료|보수|비용|부담/g, 3],
  [/만기|존속기간|투자기간|사업기간|보유기간|청산/g, 3],
  [/매각|처분|엑싯|회수|환급|상환|해지|중도/g, 3],
  [/배당|분배|수익금|정산|지급/g, 3],
  [/위험|손실|원금/g, 2],
  [/발행가액|모집가액|청약|최소|단위|1증권|모집총액/g, 2],
  [/기초자산|사업의 내용|공동사업|수익구조|구조/g, 2],
  [/유통|양도|거래|매매/g, 2],
  [/세금|과세|원천징수/g, 1],
];

export function scoreSection(s: Section): number {
  const hay = s.title + ' ' + s.text.slice(0, 20000);
  let score = 0;
  for (const [re, w] of KEYWORDS) score += (hay.match(re)?.length ?? 0) * w;
  for (const [re, w] of KEYWORDS) score += (s.title.match(re)?.length ?? 0) * w * 8;
  return score / Math.sqrt(Math.max(400, s.text.length));
}

/** GPT에 보낼 섹션 고르기: 앞부분(요약·표지) + 키워드 점수가 높은 섹션, 원래 순서 유지. */
export function selectSections(sections: Section[], maxChars = 90000, perSection = 9000): Section[] {
  const picked = new Set<number>();
  let used = 0;
  for (let i = 0; i < sections.length && i < 4 && used < 12000; i++) {
    picked.add(i);
    used += Math.min(perSection, sections[i].text.length);
  }
  const ranked = sections.map((s, i) => ({ i, sc: scoreSection(s) })).sort((a, b) => b.sc - a.sc);
  for (const { i, sc } of ranked) {
    if (sc <= 0) break;
    if (picked.has(i)) continue;
    const len = Math.min(perSection, sections[i].text.length);
    if (used + len > maxChars) continue;
    picked.add(i);
    used += len;
  }
  return [...picked].sort((a, b) => a - b).map((i) => ({ title: sections[i].title, text: sections[i].text.slice(0, perSection) }));
}

export function sectionsToPrompt(sections: Section[]): string {
  return sections.map((s) => `## ${s.title}\n${s.text.trim()}`).join('\n\n');
}

/** 질문과 겹치는 단어가 많은 섹션을 골라 챗봇 문맥으로 쓴다. */
export function sectionsForQuestion(sections: Section[], question: string, maxChars = 24000): Section[] {
  const words = question
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .map((w) => w.replace(/(은|는|이|가|을|를|에|의|로|으로|하면|하나요|인가요|있나요|되나요|어떻게|언제)$/u, ''))
    .filter((w) => w.length >= 2);
  const scored = sections.map((s, i) => {
    let sc = scoreSection(s) * 0.5;
    for (const w of words) sc += ((s.title + s.text).split(w).length - 1) * 2;
    return { i, sc };
  });
  scored.sort((a, b) => b.sc - a.sc);
  const out: number[] = [];
  let used = 0;
  for (const { i } of scored) {
    const len = Math.min(6000, sections[i].text.length);
    if (used + len > maxChars) continue;
    out.push(i);
    used += len;
    if (used > maxChars * 0.9) break;
  }
  return out.sort((a, b) => a - b).map((i) => ({ title: sections[i].title, text: sections[i].text.slice(0, 6000) }));
}
