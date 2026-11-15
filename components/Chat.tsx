'use client';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, Product } from '@/lib/types';
import { api } from '@/lib/client';
import { PRESET_QUESTIONS, sampleAnswer } from '@/lib/sampleAnswers';

interface Props {
  open: boolean;
  onClose: () => void;
  products: Product[];
  contextId: string | null;
  setContextId: (id: string | null) => void;
  pending: string | null; // 바깥에서 넘긴 질문
  clearPending: () => void;
}


export default function Chat({ open, onClose, products, contextId, setContextId, pending, clearPending }: Props) {
  const [msgs, setMsgs] = useState<(ChatMessage & { err?: boolean; sample?: boolean })[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const product = products.find((p) => p.id === contextId) ?? null;

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy]);

  /** 미리 정해진 질문: AI를 부르지 않고 샘플 답변을 보여준다. */
  const sendPreset = (q: string) => {
    if (busy) return;
    setMsgs((m) => [...m, { role: 'user', content: q }]);
    setBusy(true);
    window.setTimeout(() => {
      setMsgs((m) => [...m, { role: 'assistant', content: sampleAnswer(q, product), sample: true }]);
      setBusy(false);
    }, 500);
  };

  /** 직접 입력한 질문: 서버(OpenAI)로 보낸다. */
  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const history = msgs.filter((m) => !m.err && !m.sample).map(({ role, content }) => ({ role, content }));
    setMsgs((m) => [...m, { role: 'user', content: question }]);
    setText('');
    setBusy(true);
    try {
      const { answer } = await api.chat(question, product, history);
      setMsgs((m) => [...m, { role: 'assistant', content: answer }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', content: (e as Error).message, err: true }]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (pending && open) {
      sendPreset(pending);
      clearPending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, open]);

  if (!open) return null;
  return (
    <div className="chat-window" role="dialog" aria-label="조각나침반 에이전트">
      <div className="chat-head">
        <div>
          <strong>✦ 조각나침반 에이전트</strong>
          <p>공시 문서를 근거로 답해요. 매수·매도를 권하지 않아요.</p>
          <select className="ctx-select" value={contextId ?? ''} onChange={(e) => setContextId(e.target.value || null)} aria-label="질문할 상품">
            <option value="">상품 선택 안 함 (일반 질문)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.name}
                {p.source === 'sample' ? ' (가상)' : ''}
              </option>
            ))}
          </select>
        </div>
        <button className="close" onClick={onClose} aria-label="닫기">
          ×
        </button>
      </div>
      <div className="messages" ref={box}>
        <div className="bubble">
          안녕하세요! {product ? `"${product.name}"` : '조각투자 상품'}의 수익 구조, 돌려받는 방법, 수수료, 위험에 대해 물어보세요. 🌿
        </div>
        {msgs.map((m, i) => (
          <div key={i} className={`bubble${m.role === 'user' ? ' user' : ''}${m.err ? ' err' : ''}`}>
            {m.sample && <span className="sample-tag">샘플 답변 · AI 미사용</span>}
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="bubble">
            <span className="spinner" />
            {product?.source === 'dart' ? '공시 원문을 찾아보는 중이에요…' : '답변을 준비하는 중이에요…'}
          </div>
        )}
        {!busy && (
          <div className="chips">
            {PRESET_QUESTIONS.map((c) => (
              <button key={c} className="chip" onClick={() => sendPreset(c)}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="궁금한 점을 물어보세요" maxLength={500} aria-label="질문 입력" />
        <button type="submit" disabled={busy || !text.trim()}>
          전송
        </button>
      </form>
    </div>
  );
}
