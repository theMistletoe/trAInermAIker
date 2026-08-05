import type { ListQaResponse, QaQuestion, SubmitQaResponse } from '../../shared/schemas';
import { findAttemptGenerationForUser } from '../db/attempts';
import { answerQaQuestionsBatch, listQaQuestions, listUnansweredQaQuestions } from '../db/qa';
import type { AiDeps } from '../lib/ai';
import type { Bindings } from '../types';
import {
  AttemptNotFoundError,
  assertPhase,
  getAttemptForUser,
  QaIncompleteError,
} from './attemptService';
import { enqueueHeavyGeneration, isGenerationPendingStale } from './generationService';

export class QaCompletedError extends Error {
  constructor() {
    super('QA_COMPLETED');
    this.name = 'QaCompletedError';
  }
}

export async function getQaState(
  env: Pick<Bindings, 'DB' | 'HEAVY_AI_WORKFLOW'>,
  ai: AiDeps,
  id: number,
  userId: string,
): Promise<ListQaResponse> {
  const row = await findAttemptGenerationForUser(env.DB, id, userId);
  if (!row) throw new AttemptNotFoundError(id);
  const { attempt, generation } = row;

  if (attempt.phase !== 'qa' && attempt.phase !== 'report') {
    return { status: 'ready', questions: [], done: false };
  }

  const questions = await listQaQuestions(env.DB, id);
  if (questions.length > 0) {
    return {
      status: 'ready',
      questions,
      done: questions.every((q) => q.answer !== null),
    };
  }

  if (generation.status === 'failed' && generation.kind === 'qa') {
    return { status: 'failed', message: generation.error ?? undefined };
  }

  if (generation.status === 'pending' && generation.kind === 'qa') {
    // Sticky pending after a crash before Workflow.create — re-claim when stale.
    if (isGenerationPendingStale(attempt.updatedAt)) {
      await enqueueHeavyGeneration(env, ai, id, 'qa', { force: true });
    }
    return { status: 'generating' };
  }

  // Self-heal: phase is qa/report but no questions and no pending job (crash
  // between CAS and enqueue, or legacy rows). Re-enqueue rather than sync AI.
  if (attempt.phase === 'qa' || attempt.phase === 'report') {
    await enqueueHeavyGeneration(env, ai, id, 'qa');
    return { status: 'generating' };
  }

  return { status: 'ready', questions: [], done: false };
}

function validateAnswers(
  unanswered: QaQuestion[],
  answers: { questionId: number; answer: string }[],
): void {
  if (unanswered.length === 0) throw new QaCompletedError();
  const unansweredIds = new Set(unanswered.map((q) => q.id));
  const seen = new Set<number>();
  for (const a of answers) {
    if (!unansweredIds.has(a.questionId) || seen.has(a.questionId)) {
      throw new QaIncompleteError();
    }
    seen.add(a.questionId);
  }
  if (seen.size !== unanswered.length) throw new QaIncompleteError();
}

export async function submitAnswers(
  db: D1Database,
  id: number,
  userId: string,
  answers: { questionId: number; answer: string }[],
): Promise<SubmitQaResponse> {
  const attempt = await getAttemptForUser(db, id, userId);
  assertPhase(attempt, 'qa');
  const unanswered = await listUnansweredQaQuestions(db, id);
  validateAnswers(unanswered, answers);

  const now = new Date().toISOString();
  const ok = await answerQaQuestionsBatch(
    db,
    id,
    answers.map((a) => ({ id: a.questionId, answer: a.answer })),
    now,
  );
  if (!ok) {
    // Concurrent submit / regenerate may have changed the unanswered set between
    // validate and write. Distinguish "already done" from "still open but drifted".
    const stillOpen = await listUnansweredQaQuestions(db, id);
    if (stillOpen.length === 0) throw new QaCompletedError();
    throw new QaIncompleteError();
  }

  const questions = await listQaQuestions(db, id);
  return { questions, done: true };
}
