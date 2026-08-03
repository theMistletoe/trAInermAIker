import type { ChatMessage } from '../../shared/schemas';

interface ChatMessageRow {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

const toChatMessage = (r: ChatMessageRow): ChatMessage => ({
  id: r.id,
  role: r.role,
  content: r.content,
  createdAt: r.created_at,
});

export async function insertChatMessage(
  db: D1Database,
  attemptId: number,
  role: 'user' | 'assistant',
  content: string,
  now: string,
): Promise<ChatMessage> {
  const row = await db
    .prepare(
      'INSERT INTO chat_messages (attempt_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4) RETURNING id, role, content, created_at',
    )
    .bind(attemptId, role, content, now)
    .first<ChatMessageRow>();
  if (!row) throw new Error('insertChatMessage: no row returned');
  return toChatMessage(row);
}

/** Full conversation in insertion order (id ASC). */
export async function listChatMessages(db: D1Database, attemptId: number): Promise<ChatMessage[]> {
  const { results } = await db
    .prepare(
      'SELECT id, role, content, created_at FROM chat_messages WHERE attempt_id = ?1 ORDER BY id ASC',
    )
    .bind(attemptId)
    .all<ChatMessageRow>();
  return results.map(toChatMessage);
}

export async function countUserChatMessages(db: D1Database, attemptId: number): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM chat_messages WHERE attempt_id = ?1 AND role = 'user'")
    .bind(attemptId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}
