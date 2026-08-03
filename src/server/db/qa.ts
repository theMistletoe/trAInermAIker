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

export async function findFirstUnanswered(
  db: D1Database,
  attemptId: number,
): Promise<QaQuestion | null> {
  const row = await db
    .prepare(
      `SELECT ${QA_COLUMNS} FROM qa_questions WHERE attempt_id = ?1 AND answer IS NULL ORDER BY question_no LIMIT 1`,
    )
    .bind(attemptId)
    .first<QaQuestionRow>();
  return row ? toQaQuestion(row) : null;
}

/** Answers are write-once: the IS NULL guard makes a double-answer a no-op (false). */
export async function answerQaQuestion(
  db: D1Database,
  id: number,
  answer: string,
  now: string,
): Promise<boolean> {
  const res = await db
    .prepare(
      'UPDATE qa_questions SET answer = ?2, answered_at = ?3 WHERE id = ?1 AND answer IS NULL',
    )
    .bind(id, answer, now)
    .run();
  return res.meta.changes > 0;
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
