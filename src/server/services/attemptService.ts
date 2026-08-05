import type { Attempt, AttemptPhase, ChatMessage } from '../../shared/schemas';
import {
  clearGenerationStatus,
  findAttemptByUserAndChallenge,
  findAttemptForUser,
  insertAttempt,
  listAttemptsByUser,
  setGenerationFailed,
  updateAttemptPhase,
  updateAttemptPhaseWithPendingGeneration,
} from '../db/attempts';
import { countUserChatMessages } from '../db/chatMessages';
import { countQaQuestions } from '../db/qa';
import { findReportByAttempt } from '../db/reports';
import { findSubmissionByAttempt } from '../db/submissions';
import type { ChatTurn } from '../lib/agent';
import type { AiDeps } from '../lib/ai';
import type { Bindings } from '../types';
import { getChallengeContentOrThrow } from './challengeService';
import { startHeavyGeneration } from './generationService';

export class AttemptNotFoundError extends Error {
  constructor(public id: number) {
    super('ATTEMPT_NOT_FOUND');
    this.name = 'AttemptNotFoundError';
  }
}

export class InvalidPhaseError extends Error {
  constructor() {
    super('INVALID_PHASE');
    this.name = 'InvalidPhaseError';
  }
}

export class ChatRequiredError extends Error {
  constructor() {
    super('CHAT_REQUIRED');
    this.name = 'ChatRequiredError';
  }
}

export class SubmissionRequiredError extends Error {
  constructor() {
    super('SUBMISSION_REQUIRED');
    this.name = 'SubmissionRequiredError';
  }
}

export class QaIncompleteError extends Error {
  constructor() {
    super('QA_INCOMPLETE');
    this.name = 'QaIncompleteError';
  }
}

export function assertPhase(attempt: Attempt, expected: AttemptPhase): void {
  if (attempt.phase !== expected) throw new InvalidPhaseError();
}

export function toChatTurns(messages: ChatMessage[]): ChatTurn[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export async function createOrGetAttempt(
  db: D1Database,
  userId: string,
  challengeId: string,
): Promise<{ attempt: Attempt; created: boolean }> {
  getChallengeContentOrThrow(challengeId);
  const existing = await findAttemptByUserAndChallenge(db, userId, challengeId);
  if (existing) return { attempt: existing, created: false };
  try {
    const attempt = await insertAttempt(db, userId, challengeId, new Date().toISOString());
    return { attempt, created: true };
  } catch (err) {
    // Two concurrent first requests can both pass the pre-check; the UNIQUE
    // (user, challenge) index makes the loser land here — treat it as a get.
    const raced = await findAttemptByUserAndChallenge(db, userId, challengeId);
    if (raced) return { attempt: raced, created: false };
    throw err;
  }
}

/** Other users' attempts surface as 404, not 403: existence itself is hidden. */
export async function getAttemptForUser(
  db: D1Database,
  id: number,
  userId: string,
): Promise<Attempt> {
  const attempt = await findAttemptForUser(db, id, userId);
  if (!attempt) throw new AttemptNotFoundError(id);
  return attempt;
}

export async function listMyAttempts(db: D1Database, userId: string): Promise<Attempt[]> {
  return listAttemptsByUser(db, userId);
}

async function launchHeavyGeneration(
  env: Pick<Bindings, 'DB' | 'HEAVY_AI_WORKFLOW'>,
  ai: AiDeps,
  id: number,
  kind: 'qa' | 'report',
): Promise<void> {
  // Phase CAS already set pending; sync stub clears it, live AI keeps it until Workflow finishes.
  try {
    await startHeavyGeneration(env, ai, id, kind);
  } catch (e) {
    console.error('advanceAttempt: failed to start heavy generation', e);
    await setGenerationFailed(
      env.DB,
      id,
      kind,
      e instanceof Error ? e.message : 'failed to start generation',
      new Date().toISOString(),
    );
  }
}

export async function advanceAttempt(
  env: Pick<Bindings, 'DB' | 'HEAVY_AI_WORKFLOW'>,
  ai: AiDeps,
  id: number,
  userId: string,
): Promise<Attempt> {
  const attempt = await getAttemptForUser(env.DB, id, userId);
  const now = new Date().toISOString();
  switch (attempt.phase) {
    case 'assessment':
    case 'report':
      // assessment advances only through submitAssessment; report is terminal.
      throw new InvalidPhaseError();
    case 'requirement_chat': {
      if ((await countUserChatMessages(env.DB, id)) < 1) throw new ChatRequiredError();
      if (!(await updateAttemptPhase(env.DB, id, 'requirement_chat', 'submission', now))) {
        throw new InvalidPhaseError();
      }
      break;
    }
    case 'submission': {
      const submission = await findSubmissionByAttempt(env.DB, id);
      if (!submission) throw new SubmissionRequiredError();
      // CAS first so exactly one request owns QA generation. Live AI runs in a
      // Workflow; stub path completes synchronously inside startHeavyGeneration.
      if (
        !(await updateAttemptPhaseWithPendingGeneration(env.DB, id, 'submission', 'qa', 'qa', now))
      ) {
        throw new InvalidPhaseError();
      }
      await launchHeavyGeneration(env, ai, id, 'qa');
      break;
    }
    case 'qa': {
      const { total, unanswered } = await countQaQuestions(env.DB, id);
      if (total === 0 || unanswered > 0) throw new QaIncompleteError();
      if (
        !(await updateAttemptPhaseWithPendingGeneration(env.DB, id, 'qa', 'report', 'report', now))
      ) {
        throw new InvalidPhaseError();
      }
      if (!(await findReportByAttempt(env.DB, id))) {
        await launchHeavyGeneration(env, ai, id, 'report');
      } else {
        await clearGenerationStatus(env.DB, id, new Date().toISOString());
      }
      break;
    }
  }
  return getAttemptForUser(env.DB, id, userId);
}
