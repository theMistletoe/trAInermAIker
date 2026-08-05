import {
  clearGenerationStatus,
  findAttemptRowById,
  type GenerationKind,
  setGenerationFailed,
  setGenerationPending,
  tryClaimGenerationPending,
} from '../db/attempts';
import { listChatMessages } from '../db/chatMessages';
import { deleteQaQuestionsByAttempt, insertQaQuestions, listQaQuestions } from '../db/qa';
import { deleteReportByAttempt, insertReport } from '../db/reports';
import { findSubmissionByAttempt, listSubmissionFileContents } from '../db/submissions';
import { generateQaQuestions, generateReport } from '../lib/agent';
import type { AiDeps } from '../lib/ai';
import { stubQaQuestions, stubReport } from '../lib/stubs';
import type { Bindings } from '../types';
import { getChallengeContentOrThrow } from './challengeService';

export type HeavyAiParams = { attemptId: number; kind: GenerationKind };

function usesLiveAi(ai: AiDeps): boolean {
  return !ai.forceStub && !!ai.client;
}

async function persistQaStub(db: D1Database, attemptId: number): Promise<void> {
  await insertQaQuestions(db, attemptId, stubQaQuestions(), new Date().toISOString());
  await clearGenerationStatus(db, attemptId, new Date().toISOString());
}

async function persistReportStub(db: D1Database, attemptId: number): Promise<void> {
  const submission = await findSubmissionByAttempt(db, attemptId);
  const qaPairs = (await listQaQuestions(db, attemptId)).map((q) => ({
    category: q.category,
    question: q.question,
    answer: q.answer ?? '',
  }));
  const contentMd = stubReport({
    textFileCount: submission ? (await listSubmissionFileContents(db, submission.id)).length : 0,
    qaPairs,
  });
  await insertReport(db, attemptId, contentMd, new Date().toISOString());
  await clearGenerationStatus(db, attemptId, new Date().toISOString());
}

/** Run heavy generation synchronously (stub path) or via Workflow (live AI). */
export async function startHeavyGeneration(
  env: Pick<Bindings, 'DB' | 'HEAVY_AI_WORKFLOW'>,
  ai: AiDeps,
  attemptId: number,
  kind: GenerationKind,
): Promise<void> {
  if (!usesLiveAi(ai)) {
    if (kind === 'qa') await persistQaStub(env.DB, attemptId);
    else await persistReportStub(env.DB, attemptId);
    return;
  }
  await env.HEAVY_AI_WORKFLOW.create({
    id: `heavy-${kind}-${attemptId}-${Date.now()}`,
    params: { attemptId, kind } satisfies HeavyAiParams,
  });
}

/**
 * Mark pending + start generation.
 * - force=true (regenerate): always reset to pending then start
 * - force=false (self-heal): CAS-claim only when idle/failed to avoid double enqueue
 */
export async function enqueueHeavyGeneration(
  env: Pick<Bindings, 'DB' | 'HEAVY_AI_WORKFLOW'>,
  ai: AiDeps,
  attemptId: number,
  kind: GenerationKind,
  options: { force?: boolean } = {},
): Promise<void> {
  const now = new Date().toISOString();
  if (options.force) {
    await setGenerationPending(env.DB, attemptId, kind, now);
  } else if (!(await tryClaimGenerationPending(env.DB, attemptId, kind, now))) {
    return;
  }
  try {
    await startHeavyGeneration(env, ai, attemptId, kind);
  } catch (e) {
    console.error('enqueueHeavyGeneration: failed to start', e);
    await setGenerationFailed(
      env.DB,
      attemptId,
      kind,
      e instanceof Error ? e.message : 'failed to start generation',
      new Date().toISOString(),
    );
  }
}

/** Re-enqueue if a pending job looks abandoned (Worker crash before Workflow create). */
export const GENERATION_PENDING_STALE_MS = 15 * 60 * 1000;

export function isGenerationPendingStale(updatedAt: string, nowMs = Date.now()): boolean {
  const t = Date.parse(updatedAt);
  if (Number.isNaN(t)) return true;
  return nowMs - t >= GENERATION_PENDING_STALE_MS;
}

/** Workflow step body: load context, call AI (throws), persist, clear status. */
export async function runHeavyGeneration(
  db: D1Database,
  ai: AiDeps,
  attemptId: number,
  kind: GenerationKind,
): Promise<void> {
  const row = await findAttemptRowById(db, attemptId);
  if (!row) throw new Error(`runHeavyGeneration: attempt ${attemptId} not found`);
  const { attempt } = row;
  const challenge = getChallengeContentOrThrow(attempt.challengeId);
  const chatHistory = (await listChatMessages(db, attemptId)).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const submission = await findSubmissionByAttempt(db, attemptId);
  const submissionFiles = submission ? await listSubmissionFileContents(db, submission.id) : [];

  if (kind === 'qa') {
    const questions = await generateQaQuestions(ai, {
      challenge,
      skillProfile: attempt.skillProfile,
      chatHistory,
      submissionFiles,
    });
    await deleteQaQuestionsByAttempt(db, attemptId);
    await insertQaQuestions(db, attemptId, questions, new Date().toISOString());
  } else {
    const qaPairs = (await listQaQuestions(db, attemptId)).map((q) => ({
      category: q.category,
      question: q.question,
      answer: q.answer ?? '',
    }));
    const contentMd = await generateReport(ai, {
      challenge,
      skillProfile: attempt.skillProfile,
      chatHistory,
      submissionFiles,
      qaPairs,
    });
    await deleteReportByAttempt(db, attemptId);
    await insertReport(db, attemptId, contentMd, new Date().toISOString());
  }
  await clearGenerationStatus(db, attemptId, new Date().toISOString());
}

export async function markHeavyGenerationFailed(
  db: D1Database,
  attemptId: number,
  kind: GenerationKind,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`heavy generation failed kind=${kind} attempt=${attemptId}`, error);
  await setGenerationFailed(db, attemptId, kind, message, new Date().toISOString());
}
