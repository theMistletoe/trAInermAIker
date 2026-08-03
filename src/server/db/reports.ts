import type { Report, ReportMessage } from '../../shared/schemas';

interface ReportMessageRow {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  quoted_text: string | null;
  created_at: string;
}

const toReportMessage = (r: ReportMessageRow): ReportMessage => ({
  id: r.id,
  role: r.role,
  content: r.content,
  quotedText: r.quoted_text,
  createdAt: r.created_at,
});

export async function insertReport(
  db: D1Database,
  attemptId: number,
  contentMd: string,
  now: string,
): Promise<void> {
  await db
    .prepare('INSERT INTO reports (attempt_id, content_md, created_at) VALUES (?1, ?2, ?3)')
    .bind(attemptId, contentMd, now)
    .run();
}

export async function findReportByAttempt(
  db: D1Database,
  attemptId: number,
): Promise<Report | null> {
  const row = await db
    .prepare('SELECT content_md, created_at FROM reports WHERE attempt_id = ?1')
    .bind(attemptId)
    .first<{ content_md: string; created_at: string }>();
  return row ? { contentMd: row.content_md, createdAt: row.created_at } : null;
}

export async function insertReportMessage(
  db: D1Database,
  attemptId: number,
  role: 'user' | 'assistant',
  content: string,
  quotedText: string | null,
  now: string,
): Promise<ReportMessage> {
  const row = await db
    .prepare(
      'INSERT INTO report_messages (attempt_id, role, content, quoted_text, created_at) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id, role, content, quoted_text, created_at',
    )
    .bind(attemptId, role, content, quotedText, now)
    .first<ReportMessageRow>();
  if (!row) throw new Error('insertReportMessage: no row returned');
  return toReportMessage(row);
}

/** Follow-up thread in insertion order (id ASC). */
export async function listReportMessages(
  db: D1Database,
  attemptId: number,
): Promise<ReportMessage[]> {
  const { results } = await db
    .prepare(
      'SELECT id, role, content, quoted_text, created_at FROM report_messages WHERE attempt_id = ?1 ORDER BY id ASC',
    )
    .bind(attemptId)
    .all<ReportMessageRow>();
  return results.map(toReportMessage);
}

export async function countUserReportMessages(db: D1Database, attemptId: number): Promise<number> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM report_messages WHERE attempt_id = ?1 AND role = 'user'",
    )
    .bind(attemptId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}
