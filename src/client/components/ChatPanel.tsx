import { CHAT_MESSAGE_MAX } from '@shared/constants';
import { MESSAGES } from '@shared/messages';
import { useEffect, useRef, useState } from 'react';
import { MarkdownView } from '@/components/MarkdownView';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ChatItem } from '@/hooks/useChatThread';

interface ChatPanelProps {
  messages: ChatItem[];
  loading: boolean;
  loadFailed: boolean;
  sending: boolean;
  /** true を返したら入力欄をクリアする（失敗時は下書きを保持）。 */
  onSend: (content: string) => Promise<boolean>;
  placeholder: string;
  emptyText: string;
  /**
   * 引用チップの表示のみを担う。quote を送信ペイロードへ含めることと、
   * 送信成功後にチップを畳むこと（onQuoteClear 相当）は親の責務。
   */
  quote?: string | null;
  onQuoteClear?: () => void;
  disabled?: boolean;
}

const QUOTE_PREVIEW_MAX = 120;

export function ChatPanel({
  messages,
  loading,
  loadFailed,
  sending,
  onSend,
  placeholder,
  emptyText,
  quote = null,
  onQuoteClear,
  disabled = false,
}: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: メッセージ追加・送信中表示の変化で末尾へスクロールする
  useEffect(() => {
    // jsdom は scrollIntoView を実装しないため optional call にする。
    // instant 固定: html の scroll-behavior: smooth(トップのアンカーCTA用)に
    // チャット自動スクロールが巻き込まれてアニメーション化するのを防ぐ。
    bottomRef.current?.scrollIntoView?.({ block: 'end', behavior: 'instant' });
  }, [messages, sending]);

  const trimmed = draft.trim();
  const sendDisabled = trimmed.length === 0 || sending || disabled;

  const handleSend = async () => {
    if (sendDisabled) return;
    const sent = draft;
    const ok = await onSend(trimmed);
    // 応答待ちの間に打ち始めた次の下書きを消さないよう、送信時の値と
    // 一致する場合だけクリアする。
    if (ok) setDraft((d) => (d === sent ? '' : d));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-96 flex-col gap-3 overflow-y-auto pr-1">
        {loading ? (
          <p className="py-4 text-sm text-muted-foreground">読み込み中…</p>
        ) : loadFailed ? (
          <p className="py-4 text-sm text-destructive">{MESSAGES.chat.loadFailed}</p>
        ) : messages.length === 0 ? (
          <p data-testid="chat-empty" className="py-4 text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.key}
              data-testid="chat-message"
              data-role={m.role}
              className={
                m.role === 'user'
                  ? 'max-w-[85%] self-end rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground'
                  : 'max-w-[85%] self-start rounded-lg bg-muted px-3 py-2 text-sm'
              }
            >
              {m.role === 'assistant' ? (
                <MarkdownView markdown={m.content} />
              ) : (
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
              )}
            </div>
          ))
        )}
        {sending && (
          <div
            data-testid="chat-pending"
            className="max-w-[85%] self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"
          >
            {MESSAGES.chat.thinking}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {quote !== null && quote !== '' && (
        <div
          data-testid="report-quote"
          className="flex items-start gap-2 rounded-md border bg-muted px-3 py-2 text-xs"
        >
          <span className="shrink-0 font-medium">{MESSAGES.report.quoteLabel}</span>
          <span className="min-w-0 flex-1 break-words text-muted-foreground">
            {quote.length > QUOTE_PREVIEW_MAX ? `${quote.slice(0, QUOTE_PREVIEW_MAX)}…` : quote}
          </span>
          <button
            type="button"
            data-testid="report-quote-clear"
            aria-label="引用を解除"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => onQuoteClear?.()}
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          data-testid="chat-input"
          value={draft}
          maxLength={CHAT_MESSAGE_MAX}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="button" data-testid="chat-send" disabled={sendDisabled} onClick={handleSend}>
          {MESSAGES.chat.send}
        </Button>
      </div>
    </div>
  );
}
