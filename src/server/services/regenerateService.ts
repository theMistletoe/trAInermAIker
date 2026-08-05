import type { Attempt } from '../../shared/schemas';
import type { GenerationKind } from '../db/attempts';
import { findAttemptGenerationForUser } from '../db/attempts';
import { deleteQaQuestionsByAttempt } from '../db/qa';
import { deleteReportByAttempt } from '../db/reports';
import type { AiDeps } from '../lib/ai';
import type { Bindings } from '../types';
import { AttemptNotFoundError, InvalidPhaseError } from './attemptService';
import { enqueueHeavyGeneration } from './generationService';

/**
 * Clear prior heavy-AI artifacts and re-enqueue generation for the current phase.
 * Allows recovering from failed jobs and from legacy stub reports persisted before
 * async generation.
 */
export async function regenerateHeavyGeneration(
  env: Pick<Bindings, 'DB' | 'HEAVY_AI_WORKFLOW'>,
  ai: AiDeps,
  id: number,
  userId: string,
  kind: GenerationKind,
): Promise<Attempt> {
  const row = await findAttemptGenerationForUser(env.DB, id, userId);
  if (!row) throw new AttemptNotFoundError(id);
  const { attempt } = row;

  if (kind === 'qa') {
    if (attempt.phase !== 'qa') throw new InvalidPhaseError();
  } else if (attempt.phase !== 'report') {
    throw new InvalidPhaseError();
  }

  // Always restart: clears stuck `pending` jobs (Workflow crash before mark-failed)
  // and replaces legacy stub artifacts. Concurrent old Workflow instances may still
  // finish; runHeavyGeneration deletes-then-inserts so the last writer wins.
  if (kind === 'qa') {
    await deleteQaQuestionsByAttempt(env.DB, id);
  } else {
    await deleteReportByAttempt(env.DB, id);
  }

  await enqueueHeavyGeneration(env, ai, id, kind, { force: true });
  const updated = await findAttemptGenerationForUser(env.DB, id, userId);
  if (!updated) throw new AttemptNotFoundError(id);
  return updated.attempt;
}
