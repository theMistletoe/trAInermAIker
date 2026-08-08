import { MESSAGES } from '@shared/messages';
import { listQa } from '@/api/client';
import { useHistoryData } from '@/hooks/useHistoryData';
import { HistoryLoadError } from './HistoryLoadError';

/**
 * QA の質問と回答の読み取り専用リスト。report フェーズでのみマウントされる
 * (それ以前の listQa は空を返すだけで意味がなく、呼ばない)。
 */
export function QaHistoryView({ attemptId }: { attemptId: number }) {
  const { state, retry } = useHistoryData(listQa, attemptId);

  if (state.status === 'loading') {
    return <p className="py-4 text-sm text-muted-foreground">読み込み中…</p>;
  }
  if (state.status === 'error') {
    return <HistoryLoadError onRetry={retry} />;
  }
  const questions = state.data.status === 'ready' ? state.data.questions : [];
  if (questions.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{MESSAGES.history.qaEmpty}</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {questions.map((q) => (
        <li key={q.id} data-testid="history-qa-item" className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            Q{q.questionNo}. {q.question}
          </p>
          <p className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-sm">
            {q.answer ?? MESSAGES.history.noAnswer}
          </p>
        </li>
      ))}
    </ol>
  );
}
