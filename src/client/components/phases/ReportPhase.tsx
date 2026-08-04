import { MESSAGES } from '@shared/messages';
import type { Attempt, Report, ReportMessage } from '@shared/schemas';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { askReportQuestion, getReport, listReportMessages } from '@/api/client';
import { ChatPanel } from '@/components/ChatPanel';
import { ReportView } from '@/components/ReportView';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChatItem, useChatThread } from '@/hooks/useChatThread';

interface ReportPhaseProps {
  attempt: Attempt;
}

type ReportState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; report: Report };

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
  const [quote, setQuote] = useState<string | null>(null);
  const { messages, loading, loadFailed, sending, send } = useChatThread({
    load: async () => (await listReportMessages(attempt.id)).messages.map(toItem),
    send: async (content, quotedText) => {
      const res = await askReportQuestion(attempt.id, content, quotedText);
      return [toItem(res.userMessage), toItem(res.assistantMessage)];
    },
  });

  useEffect(() => {
    let alive = true;
    getReport(attempt.id)
      .then((res) => {
        if (alive) setState({ status: 'ready', report: res.report });
      })
      .catch(() => {
        if (alive) setState({ status: 'error' });
      });
    return () => {
      alive = false;
    };
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

  if (state.status === 'loading') {
    return (
      <p data-testid="report-generating" className="py-8 text-center text-muted-foreground">
        {MESSAGES.report.generating}
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {MESSAGES.report.loadFailed}
      </p>
    );
  }
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">{MESSAGES.report.title}</h2>
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
