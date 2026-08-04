import { MESSAGES } from '@shared/messages';
import type { Attempt, ChatMessage } from '@shared/schemas';
import { useState } from 'react';
import { toast } from 'sonner';
import { advanceAttempt, listChatMessages, postChatMessage } from '@/api/client';
import { ChatPanel } from '@/components/ChatPanel';
import { Button } from '@/components/ui/button';
import { type ChatItem, useChatThread } from '@/hooks/useChatThread';

interface RequirementChatPhaseProps {
  attempt: Attempt;
  onAttempt: (attempt: Attempt) => void;
}

const toItem = (m: ChatMessage): ChatItem => ({
  key: `msg-${m.id}`,
  role: m.role,
  content: m.content,
  quotedText: null,
  pending: false,
});

export function RequirementChatPhase({ attempt, onAttempt }: RequirementChatPhaseProps) {
  const [advancing, setAdvancing] = useState(false);
  const { messages, loading, loadFailed, sending, send } = useChatThread({
    load: async () => (await listChatMessages(attempt.id)).messages.map(toItem),
    send: async (content) => {
      const res = await postChatMessage(attempt.id, content);
      return [toItem(res.userMessage), toItem(res.assistantMessage)];
    },
  });

  const handleSend = async (content: string) => {
    const ok = await send(content);
    if (!ok) toast.error(MESSAGES.chat.sendFailed);
    return ok;
  };

  // ヒアリングを一度もしないまま先へ進めないよう、確定済みのユーザー発言を要求する。
  const hasUserMessage = messages.some((m) => m.role === 'user' && !m.pending);

  const handleAdvance = async () => {
    if (advancing) return;
    setAdvancing(true);
    try {
      const res = await advanceAttempt(attempt.id);
      onAttempt(res.attempt);
    } catch {
      toast.error(MESSAGES.attempt.advanceFailed);
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <ChatPanel
        messages={messages}
        loading={loading}
        loadFailed={loadFailed}
        sending={sending}
        onSend={handleSend}
        placeholder={MESSAGES.chat.placeholder}
        emptyText={MESSAGES.chat.empty}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          data-testid="phase-advance-button"
          disabled={advancing || !hasUserMessage}
          onClick={handleAdvance}
        >
          {advancing ? MESSAGES.attempt.advancing : MESSAGES.attempt.advance}
        </Button>
      </div>
    </section>
  );
}
