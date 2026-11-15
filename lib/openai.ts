// OpenAI Chat Completions 호출(fetch). 키는 서버에서만 쓴다.

export class LlmError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export const model = () => process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const isReasoning = (m: string) => /^(gpt-5|o\d)/.test(m);

interface Msg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function call(body: Record<string, unknown>): Promise<string> {
  const k = (process.env.OPENAI_API_KEY ?? '').trim().replace(/^["']|["']$/g, '');
  if (!k) throw new LlmError('서버에 OPENAI_API_KEY가 설정되지 않았어요.', 500);
  const m = model();
  const payload: Record<string, unknown> = { model: m, ...body };
  if (isReasoning(m) && !('reasoning_effort' in payload)) payload.reasoning_effort = 'low';
  if (!isReasoning(m)) delete payload.reasoning_effort;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k}` },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('openai error', res.status, text.slice(0, 500));
    if (res.status === 401) throw new LlmError('OpenAI 키가 올바르지 않아요.', 500);
    if (res.status === 429) throw new LlmError('AI 사용량 한도에 걸렸어요. 잠시 후 다시 시도해 주세요.', 429);
    if (res.status === 404 || /model/i.test(text)) throw new LlmError(`AI 모델(${m})을 쓸 수 없어요. OPENAI_MODEL 설정을 확인해 주세요.`, 500);
    throw new LlmError(`AI 응답 오류 (${res.status})`);
  }
  const j = (await res.json()) as { choices?: { message?: { content?: string; refusal?: string } ; finish_reason?: string }[] };
  const choice = j.choices?.[0];
  if (choice?.message?.refusal) throw new LlmError('AI가 이 요청에 답하지 않았어요.');
  const content = choice?.message?.content;
  if (!content) throw new LlmError(choice?.finish_reason === 'length' ? 'AI 응답이 너무 길어 잘렸어요.' : 'AI 응답이 비어 있어요.');
  return content;
}

export async function chatJSON<T>(opts: { system: string; user: string; schemaName: string; schema: object; maxTokens?: number }): Promise<T> {
  const content = await call({
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    response_format: { type: 'json_schema', json_schema: { name: opts.schemaName, strict: true, schema: opts.schema } },
    max_completion_tokens: opts.maxTokens ?? 12000,
  });
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new LlmError('AI 응답을 해석하지 못했어요.');
  }
}

export async function chatText(messages: Msg[], maxTokens = 2500): Promise<string> {
  return call({ messages, max_completion_tokens: maxTokens });
}
