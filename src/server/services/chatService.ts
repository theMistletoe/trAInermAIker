import { CHAT_USER_MESSAGES_MAX } from '../../shared/constants';
import type { ChatMessage } from '../../shared/schemas';
import { countUserChatMessages, insertChatMessage, listChatMessages } from '../db/chatMessages';
import { type ChatTurn, requirementChatReply } from '../lib/agent';
import type { AiDeps } from '../lib/ai';
import { assertPhase, getAttemptForUser } from './attemptService';
import { getChallengeContentOrThrow } from './challengeService';

export class ChatLimitExceededError extends Error {
  constructor() {
    super('CHAT_LIMIT_EXCEEDED');
    this.name = 'ChatLimitExceededError';
  }
}

/** Attempt-scoped and readable in any phase (the chat log stays visible later). */
export async function listMessages(
  db: D1Database,
  id: number,
  userId: string,
): Promise<ChatMessage[]> {
  await getAttemptForUser(db, id, userId);
  return listChatMessages(db, id);
}

export async function postMessage(
  db: D1Database,
  ai: AiDeps,
  id: number,
  userId: string,
  message: string,
): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage }> {
  const attempt = await getAttemptForUser(db, id, userId);
  assertPhase(attempt, 'requirement_chat');
  if ((await countUserChatMessages(db, id)) >= CHAT_USER_MESSAGES_MAX) {
    throw new ChatLimitExceededError();
  }
  const challenge = getChallengeContentOrThrow(attempt.challengeId);
  // Snapshot before inserting: the new message goes to the agent as
  // `userMessage`, so it must not also appear in `history`.
  const history: ChatTurn[] = (await listChatMessages(db, id)).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const userMessage = await insertChatMessage(db, id, 'user', message, new Date().toISOString());
  const reply = await requirementChatReply(ai, {
    challenge,
    skillProfile: attempt.skillProfile,
    history,
    userMessage: message,
  });
  const assistantMessage = await insertChatMessage(
    db,
    id,
    'assistant',
    reply,
    new Date().toISOString(),
  );
  return { userMessage, assistantMessage };
}
