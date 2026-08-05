import type { ListQaResponse, QaQuestion } from '../../shared/schemas';
import { findAttemptGenerationForUser } from '../db/attempts';
import { answerQaQuestion, countQaQuestions, findFirstUnanswered, listQaQuestions } from '../db/qa';
import type { AiDeps } from '../lib/ai';
import type { Bindings } from '../types';
import { AttemptNotFoundError, assertPhase, getAttemptForUser } from './attemptService';
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

  const counts = await countQaQuestions(env.DB, id);
  if (counts.total > 0) {
    return {
      status: 'ready',
      questions: await listQaQuestions(env.DB, id),
      done: counts.unanswered === 0,
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
