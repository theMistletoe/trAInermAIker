import { MESSAGES } from '@shared/messages';
import type { Attempt, Report, ReportMessage } from '@shared/schemas';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  askReportQuestion,
  getReport,
  listReportMessages,
  regenerateGeneration,
} from '@/api/client';
import { ChatPanel } from '@/components/ChatPanel';
import { ReportView } from '@/components/ReportView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChatItem, useChatThread } from '@/hooks/useChatThread';

interface ReportPhaseProps {
  attempt: Attempt;
}

type ReportState =
  | { status: 'loading' }
  | { status: 'generating' }
  | { status: 'error' }
  | { status: 'failed'; message?: string }
  | { status: 'ready'; report: Report };

const POLL_MS = 1500;

const toItem = (m: ReportMessage): ChatItem => ({
  key: `msg-${m.id}`,
  role: m.role,
  // 引用付き質問は、どの箇所への質問だったか履歴からも分かるよう引用を前置する。
  content:
    m.role === 'user' && m.quotedText !== null
      ? `【引用】${m.quotedText}\n${m.content}`
      : m.content,
  quotedText: m.quotedText,
  pending: false,
});

export function ReportPhase({ attempt }: ReportPhaseProps) {
  const [state, setState] = useState<ReportState>({ status: 'loading' });
  const [pollEpoch, setPollEpoch] = useState(0);
  const [quote, setQuote] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const { messages, loading, loadFailed, sending, send } = useChatThread({
    load: async () => (await listReportMessages(attempt.id)).messages.map(toItem),
    send: async (content, quotedText) => {
      const res = await askReportQuestion(attempt.id, content, quotedText);
      return [toItem(res.userMessage), toItem(res.assistantMessage)];
    },
  });

  useEffect(() => {
    // pollEpoch intentionally restarts this effect after regenerate.
    void pollEpoch;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const res = await getReport(attempt.id);
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
        setState({ status: 'ready', report: res.report });
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

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      await regenerateGeneration(attempt.id, 'report');
      setState({ status: 'generating' });
      setPollEpoch((n) => n + 1);
    } catch {
      toast.error(MESSAGES.report.generateFailed);
    } finally {
      setRetrying(false);
    }
  }, [attempt.id]);

  const handleSend = async (content: string) => {
    const ok = await send(content, quote);
    if (!ok) {
      toast.error(MESSAGES.chat.sendFailed);
      return false;
    }
    setQuote(null);
    return true;
  };

  if (state.status === 'loading' || state.status === 'generating') {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p data-testid="report-generating" className="text-center text-muted-foreground">
          {MESSAGES.report.generating}
        </p>
        {state.status === 'generating' && (
          <Button
            type="button"
            variant="outline"
            data-testid="report-retry-button"
            disabled={retrying}
            onClick={() => void retry()}
          >
            {MESSAGES.report.retry}
          </Button>
        )}
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {MESSAGES.report.loadFailed}
      </p>
    );
  }
  if (state.status === 'failed') {
    return (
      <div className="flex flex-col items-start gap-3 py-8">
        <p data-testid="report-generate-failed" className="text-sm text-destructive">
          {state.message?.trim() || MESSAGES.report.generateFailed}
        </p>
        <Button
          type="button"
          data-testid="report-retry-button"
          disabled={retrying}
          onClick={() => void retry()}
        >
          {MESSAGES.report.retry}
        </Button>
      </div>
    );
  }
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{MESSAGES.report.title}</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="report-regenerate-button"
          disabled={retrying}
          onClick={() => void retry()}
        >
          {MESSAGES.report.regenerate}
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <ReportView markdown={state.report.contentMd} onAsk={setQuote} />
        <Card className="self-start py-4">
          <CardHeader className="px-4">
            <CardTitle>{MESSAGES.report.chatTitle}</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <ChatPanel
              messages={messages}
              loading={loading}
              loadFailed={loadFailed}
              sending={sending}
              onSend={handleSend}
              placeholder={MESSAGES.report.askPlaceholder}
              emptyText={MESSAGES.report.chatEmpty}
              quote={quote}
              onQuoteClear={() => setQuote(null)}
            />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
