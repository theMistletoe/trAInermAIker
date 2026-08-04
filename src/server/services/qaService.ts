import type { QaQuestion } from '../../shared/schemas';
import { listChatMessages } from '../db/chatMessages';
import {
  answerQaQuestion,
  countQaQuestions,
  findFirstUnanswered,
  insertQaQuestions,
  listQaQuestions,
} from '../db/qa';
import { findSubmissionByAttempt, listSubmissionFileContents } from '../db/submissions';
import { generateQaQuestions } from '../lib/agent';
import type { AiDeps } from '../lib/ai';
import { assertPhase, getAttemptForUser } from './attemptService';
import { getChallengeContentOrThrow } from './challengeService';

export class QaCompletedError extends Error {
  constructor() {
    super('QA_COMPLETED');
    this.name = 'QaCompletedError';
  }
}

export async function getQaState(
  db: D1Database,
  ai: AiDeps,
  id: number,
  userId: string,
): Promise<{ questions: QaQuestion[]; done: boolean }> {
  const attempt = await getAttemptForUser(db, id, userId);
  let counts = await countQaQuestions(db, id);
  if ((attempt.phase === 'qa' || attempt.phase === 'report') && counts.total === 0) {
    // Self-heal: advanceAttempt CAS-claimed the qa phase but crashed before
    // inserting questions. Generation never throws (stub fallback).
    const submission = await findSubmissionByAttempt(db, id);
    const questions = await generateQaQuestions(ai, {
      challenge: getChallengeContentOrThrow(attempt.challengeId),
      skillProfile: attempt.skillProfile,
      chatHistory: (await listChatMessages(db, id)).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      submissionFiles: submission ? await listSubmissionFileContents(db, submission.id) : [],
    });
    await insertQaQuestions(db, id, questions, new Date().toISOString());
    counts = await countQaQuestions(db, id);
  }
  return {
    questions: await listQaQuestions(db, id),
    done: counts.total > 0 && counts.unanswered === 0,
  };
}

export async function answerQuestion(
  db: D1Database,
  id: number,
  userId: string,
  answer: string,
): Promise<{ answered: QaQuestion; next: QaQuestion | null; remaining: number }> {
  const attempt = await getAttemptForUser(db, id, userId);
  assertPhase(attempt, 'qa');
  const target = await findFirstUnanswered(db, id);
  if (!target) throw new QaCompletedError();
  const now = new Date().toISOString();
  // CAS on "still unanswered": a concurrent answer for the same question loses.
  if (!(await answerQaQuestion(db, target.id, answer, now))) throw new QaCompletedError();
  const answered = (await listQaQuestions(db, id)).find((q) => q.id === target.id) ?? {
    ...target,
    answer,
    answeredAt: now,
  };
  const next = await findFirstUnanswered(db, id);
  const { unanswered } = await countQaQuestions(db, id);
  return { answered, next, remaining: unanswered };
}
