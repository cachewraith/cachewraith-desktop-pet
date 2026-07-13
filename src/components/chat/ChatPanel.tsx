/**
 * Compact expandable chat panel rendered inside the (temporarily enlarged)
 * pet window.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import type { ChatMessageRecord } from '../../features/chat/chat.repository';

interface ChatPanelProps {
  petName: string;
  messages: ChatMessageRecord[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function ChatPanel({
  petName,
  messages,
  loading,
  sending,
  error,
  onSend,
  onClear,
  onClose,
}: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages, sending]);

  const submit = () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    onSend(text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <section className="chat-panel" aria-label={`Chat with ${petName}`}>
      <header className="chat-header">
        <span className="chat-title">💬 {petName}</span>
        <div className="chat-header-actions">
          <button
            type="button"
            className="icon-button"
            onClick={onClear}
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            🧹
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            title="Close chat (Esc)"
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="chat-messages" ref={listRef} tabIndex={0} aria-label="Message history">
        {loading && <p className="chat-hint">Loading history…</p>}
        {!loading && messages.length === 0 && (
          <p className="chat-hint">
            Say hi! {petName} listens even without an API key — add one in Settings for smarter
            replies.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === 'user' ? 'chat-msg chat-msg-user' : 'chat-msg chat-msg-pet'}
          >
            {message.content}
          </div>
        ))}
        {sending && <div className="chat-msg chat-msg-pet chat-msg-thinking">…thinking</div>}
      </div>

      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}

      <div className="chat-input-row">
        <textarea
          ref={inputRef}
          className="chat-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message… (Enter sends, Shift+Enter = new line)"
          rows={2}
          aria-label="Chat message"
        />
        <button
          type="button"
          className="chat-send"
          onClick={submit}
          disabled={sending || !draft.trim()}
          aria-label="Send message"
        >
          ➤
        </button>
      </div>
    </section>
  );
}
