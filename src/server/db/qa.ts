import type { QaCategory, QaQuestion } from '../../shared/schemas';

interface QaQuestionRow {
  id: number;
  question_no: number;
  category: QaCategory;
  question: string;
  answer: string | null;
  answered_at: string | null;
}

const toQaQuestion = (r: QaQuestionRow): QaQuestion => ({
  id: r.id,
  questionNo: r.question_no,
  category: r.category,
  question: r.question,
  answer: r.answer,
  answeredAt: r.answered_at,
});

const QA_COLUMNS = 'id, question_no, category, question, answer, answered_at';

const BATCH_SIZE = 50;

export async function insertQaQuestions(
  db: D1Database,
  attemptId: number,
  questions: { category: QaCategory; question: string }[],
  now: string,
): Promise<void> {
  const stmts = questions.map((q, i) =>
    db
      .prepare(
        'INSERT INTO qa_questions (attempt_id, question_no, category, question, created_at) VALUES (?1, ?2, ?3, ?4, ?5)',
      )
      .bind(attemptId, i + 1, q.category, q.question, now),
  );
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    await db.batch(stmts.slice(i, i + BATCH_SIZE));
  }
}

export async function listQaQuestions(db: D1Database, attemptId: number): Promise<QaQuestion[]> {
  const { results } = await db
    .prepare(
      `SELECT ${QA_COLUMNS} FROM qa_questions WHERE attempt_id = ?1 ORDER BY question_no ASC`,
    )
    .bind(attemptId)
    .all<QaQuestionRow>();
  return results.map(toQaQuestion);
}

export async function listUnansweredQaQuestions(
  db: D1Database,
  attemptId: number,
): Promise<QaQuestion[]> {
  const { results } = await db
    .prepare(
      `SELECT ${QA_COLUMNS} FROM qa_questions WHERE attempt_id = ?1 AND answer IS NULL ORDER BY question_no ASC`,
    )
    .bind(attemptId)
    .all<QaQuestionRow>();
  return results.map(toQaQuestion);
}

/**
 * Write-once batch answer. The unanswered-count guard makes the UPDATE a no-op
 * (0 changes) if any target is already answered or the set drifted — so we never
 * partially commit a form submit under concurrency.
 */
export async function answerQaQuestionsBatch(
  db: D1Database,
  attemptId: number,
  answers: { id: number; answer: string }[],
  now: string,
): Promise<boolean> {
  if (answers.length === 0) return false;
  const caseSql = answers.map(() => 'WHEN ? THEN ?').join(' ');
  const inSql = answers.map(() => '?').join(', ');
  const binds: (string | number)[] = [];
  for (const a of answers) {
    binds.push(a.id, a.answer);
  }
  binds.push(now, attemptId);
  for (const a of answers) {
    binds.push(a.id);
  }
  binds.push(attemptId, answers.length);

  const res = await db
    .prepare(
      `UPDATE qa_questions
       SET answer = CASE id ${caseSql} END, answered_at = ?
       WHERE attempt_id = ?
         AND id IN (${inSql})
         AND answer IS NULL
         AND (SELECT COUNT(*) FROM qa_questions WHERE attempt_id = ? AND answer IS NULL) = ?`,
    )
    .bind(...binds)
    .run();
  return res.meta.changes === answers.length;
}

export async function countQaQuestions(
  db: D1Database,
  attemptId: number,
): Promise<{ total: number; unanswered: number }> {
  // COALESCE: SUM over zero rows is NULL, not 0.
  const row = await db
    .prepare(
      'SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN answer IS NULL THEN 1 ELSE 0 END), 0) AS unanswered FROM qa_questions WHERE attempt_id = ?1',
    )
    .bind(attemptId)
    .first<{ total: number; unanswered: number }>();
  return row ?? { total: 0, unanswered: 0 };
}

export async function deleteQaQuestionsByAttempt(db: D1Database, attemptId: number): Promise<void> {
  await db.prepare('DELETE FROM qa_questions WHERE attempt_id = ?1').bind(attemptId).run();
}
