import { MESSAGES } from '@shared/messages';
import { listChatMessages } from '@/api/client';
import { MarkdownView } from '@/components/MarkdownView';
import { useHistoryData } from '@/hooks/useHistoryData';
import { HistoryLoadError } from './HistoryLoadError';

interface ChatTranscriptProps {
  attemptId: number;
}

/**
 * 要件ヒアリングのチャットログの読み取り専用表示。
 * ChatPanel は composer(入力欄)を常に描画し `chat-message` testid が E2E 契約に
 * 含まれるため再利用せず、履歴用の名前空間(history-*)で独立させる。
 */
export function ChatTranscript({ attemptId }: ChatTranscriptProps) {
  const { state, retry } = useHistoryData(listChatMessages, attemptId);

  if (state.status === 'loading') {
    return <p className="py-4 text-sm text-muted-foreground">読み込み中…</p>;
  }
  if (state.status === 'error') {
    return <HistoryLoadError onRetry={retry} />;
  }
  const { messages } = state.data;
  if (messages.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{MESSAGES.history.chatEmpty}</p>;
  }
  return (
    <div className="flex max-h-96 flex-col gap-3 overflow-y-auto pr-1">
      {messages.map((m) => (
        <div
          key={m.id}
          data-testid="history-chat-message"
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
      ))}
    </div>
  );
}
