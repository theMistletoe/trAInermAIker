import { MESSAGES } from '@shared/messages';
import type { Attempt, QaQuestion } from '@shared/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { advanceAttempt, answerQa, listQa, regenerateGeneration } from '@/api/client';
import { ChatPanel } from '@/components/ChatPanel';
import { Button } from '@/components/ui/button';
import type { ChatItem } from '@/hooks/useChatThread';

interface QaPhaseProps {
  attempt: Attempt;
  onAttempt: (attempt: Attempt) => void;
}

type QaState =
  | { status: 'loading' }
  | { status: 'generating' }
  | { status: 'error' }
  | { status: 'failed'; message?: string }
  | { status: 'ready'; questions: QaQuestion[]; done: boolean };

const POLL_MS = 1500;

// 質問 → assistant 発言、回答済みなら直後に user 発言、の順でチャット風に並べる。
const toItems = (questions: QaQuestion[]): ChatItem[] =>
  questions.flatMap((q) => {
    const items: ChatItem[] = [
      {
        key: `q-${q.id}`,
        role: 'assistant',
        content: q.question,
        quotedText: null,
        pending: false,
      },
    ];
    if (q.answer !== null) {
      items.push({
        key: `a-${q.id}`,
        role: 'user',
        content: q.answer,
        quotedText: null,
        pending: false,
      });
    }
    return items;
  });

export function QaPhase({ attempt, onAttempt }: QaPhaseProps) {
  const [state, setState] = useState<QaState>({ status: 'loading' });
  const [pollEpoch, setPollEpoch] = useState(0);
  const [answering, setAnswering] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [advanceFailed, setAdvanceFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const advancingRef = useRef(false);
  const autoAdvancedRef = useRef(false);

  useEffect(() => {
    // pollEpoch intentionally restarts this effect after regenerate.
    void pollEpoch;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const res = await listQa(attempt.id);
        if (!alive) return;
        if (res.status === 'generating') {
          setState({ status: 'generating' });
          timer = setTimeout(() => {
            void load();
          }, POLL_MS);
          return;
        }
        if (res.status === 'failed') {
          setState(
            res.message !== undefined
              ? { status: 'failed', message: res.message }
              : { status: 'failed' },
          );
          return;
        }
        setState({ status: 'ready', questions: res.questions, done: res.done });
      } catch {
        if (alive) setState({ status: 'error' });
      }
    };

    void load();
    return () => {
      alive = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [attempt.id, pollEpoch]);

  const advance = useCallback(async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setAdvancing(true);
    setAdvanceFailed(false);
    try {
      const res = await advanceAttempt(attempt.id);
      onAttempt(res.attempt);
    } catch {
      setAdvanceFailed(true);
      toast.error(MESSAGES.attempt.advanceFailed);
    } finally {
      advancingRef.current = false;
      setAdvancing(false);
    }
  }, [attempt.id, onAttempt]);

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      await regenerateGeneration(attempt.id, 'qa');
      setState({ status: 'generating' });
      setPollEpoch((n) => n + 1);
    } catch {
      toast.error(MESSAGES.qa.generateFailed);
    } finally {
      setRetrying(false);
    }
  }, [attempt.id]);

  const done = state.status === 'ready' && state.done;

  // 全問回答が確定したら自動でレポート生成(advance)へ進む。失敗時は手動ボタンに
  // フォールバックするので、自動発火は一度きりにする。
  useEffect(() => {
    if (!done || autoAdvancedRef.current) return;
    autoAdvancedRef.current = true;
    void advance();
  }, [done, advance]);

  const handleAnswer = async (answer: string): Promise<boolean> => {
    if (answering) return false;
    setAnswering(true);
    try {
      const { answered, next } = await answerQa(attempt.id, answer);
      setState((prev) => {
        if (prev.status !== 'ready') return prev;
        const questions = prev.questions.map((q) => (q.id === answered.id ? answered : q));
        if (next !== null && !questions.some((q) => q.id === next.id)) {
          questions.push(next);
        }
        return { status: 'ready', questions, done: next === null };
      });
      return true;
    } catch {
      toast.error(MESSAGES.qa.answerFailed);
      return false;
    } finally {
      setAnswering(false);
    }
  };

  if (state.status === 'error') {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {MESSAGES.qa.loadFailed}
      </p>
    );
  }

  if (state.status === 'generating' || state.status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p data-testid="qa-generating" className="text-center text-muted-foreground">
          {MESSAGES.qa.generating}
        </p>
        {state.status === 'generating' && (
          <Button
            type="button"
            variant="outline"
            data-testid="qa-retry-button"
            disabled={retrying}
            onClick={() => void retry()}
          >
            {MESSAGES.qa.retry}
          </Button>
        )}
      </div>
    );
  }

  if (state.status === 'failed') {
    return (
      <div className="flex flex-col items-start gap-3 py-8">
        <p data-testid="qa-generate-failed" className="text-sm text-destructive">
          {state.message?.trim() || MESSAGES.qa.generateFailed}
        </p>
        <Button
          type="button"
          data-testid="qa-retry-button"
          disabled={retrying}
          onClick={() => void retry()}
        >
          {MESSAGES.qa.retry}
        </Button>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{MESSAGES.qa.lead}</p>
      <ChatPanel
        messages={toItems(state.questions)}
        loading={false}
        loadFailed={false}
        sending={answering}
        onSend={handleAnswer}
        placeholder={MESSAGES.qa.answerPlaceholder}
        emptyText={MESSAGES.qa.lead}
        disabled={done}
      />
      {done && (
        <p data-testid="qa-completed" className="text-sm text-muted-foreground">
          {MESSAGES.qa.completed}
        </p>
      )}
      {(advanceFailed || advancing) && (
        <div className="flex justify-end">
          <Button
            type="button"
            data-testid="phase-advance-button"
            disabled={advancing}
            onClick={advance}
          >
            {advancing ? MESSAGES.attempt.advancing : MESSAGES.attempt.advance}
          </Button>
        </div>
      )}
    </section>
  );
}
