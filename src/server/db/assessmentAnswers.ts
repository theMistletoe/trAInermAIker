import type { AssessmentAnswer } from '../../shared/schemas';

interface AssessmentAnswerRow {
  question_id: string;
  answer_value: string;
}

const toAssessmentAnswer = (r: AssessmentAnswerRow): AssessmentAnswer => ({
  questionId: r.question_id,
  value: r.answer_value,
});

const BATCH_SIZE = 50;

export async function insertAssessmentAnswers(
  db: D1Database,
  attemptId: number,
  answers: { questionId: string; value: string }[],
  now: string,
): Promise<void> {
  // Upsert: a submit that failed AFTER this insert (AI eval / phase CAS) must
  // be retryable — a plain INSERT would hit UNIQUE(attempt_id, question_id)
  // forever and permanently brick the attempt.
  const stmts = answers.map((a) =>
    db
      .prepare(
        'INSERT INTO assessment_answers (attempt_id, question_id, answer_value, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (attempt_id, question_id) DO UPDATE SET answer_value = excluded.answer_value',
      )
      .bind(attemptId, a.questionId, a.value, now),
  );
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    await db.batch(stmts.slice(i, i + BATCH_SIZE));
  }
}

export async function listAssessmentAnswers(
  db: D1Database,
  attemptId: number,
): Promise<AssessmentAnswer[]> {
  const { results } = await db
    .prepare(
      'SELECT question_id, answer_value FROM assessment_answers WHERE attempt_id = ?1 ORDER BY question_id',
    )
    .bind(attemptId)
    .all<AssessmentAnswerRow>();
  return results.map(toAssessmentAnswer);
}
