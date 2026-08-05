import { env } from 'cloudflare:test';
import { insertAttempt } from '@server/db/attempts';
import { answerQaQuestionsBatch, insertQaQuestions, listQaQuestions } from '@server/db/qa';
import { beforeAll, describe, expect, it } from 'vitest';

describe('answerQaQuestionsBatch', () => {
  let attemptId = 0;

  beforeAll(async () => {
    const now = '2026-01-01T00:00:00.000Z';
    const attempt = await insertAttempt(
      env.DB,
      `qa-batch-${crypto.randomUUID()}`,
      'aws-cdk-file-sharing',
      now,
    );
    attemptId = attempt.id;
    await insertQaQuestions(
      env.DB,
      attemptId,
      [
        { category: 'gap', question: 'Q1' },
        { category: 'learning_point', question: 'Q2' },
        { category: 'growth', question: 'Q3' },
      ],
      now,
    );
  });

  it('未回答数と一致しない更新は 0 行で、既存の NULL を維持する', async () => {
    const questions = await listQaQuestions(env.DB, attemptId);
    expect(questions).toHaveLength(3);

    const ok = await answerQaQuestionsBatch(
      env.DB,
      attemptId,
      [{ id: questions[0]!.id, answer: 'だけ回答' }],
      '2026-01-01T00:01:00.000Z',
    );
    expect(ok).toBe(false);

    const after = await listQaQuestions(env.DB, attemptId);
    expect(after.every((q) => q.answer === null)).toBe(true);
  });

  it('未回答全件と一致する更新は全行を書き込む', async () => {
    const questions = await listQaQuestions(env.DB, attemptId);
    const ok = await answerQaQuestionsBatch(
      env.DB,
      attemptId,
      questions.map((q, i) => ({ id: q.id, answer: `A${i + 1}` })),
      '2026-01-01T00:02:00.000Z',
    );
    expect(ok).toBe(true);

    const after = await listQaQuestions(env.DB, attemptId);
    expect(after.map((q) => q.answer)).toEqual(['A1', 'A2', 'A3']);
  });
});
