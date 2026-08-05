import { REPORT_QA_MESSAGES_MAX } from '../../shared/constants';
import type { GetReportResponse, ReportMessage } from '../../shared/schemas';
import { findAttemptGenerationForUser } from '../db/attempts';
import {
  countUserReportMessages,
  findReportByAttempt,
  insertReportMessage,
  listReportMessages,
} from '../db/reports';
import { answerReportQuestion } from '../lib/agent';
import type { AiDeps } from '../lib/ai';
import type { Bindings } from '../types';
import { AttemptNotFoundError, assertPhase, getAttemptForUser } from './attemptService';
import { getChallengeContentOrThrow } from './challengeService';
// 1:1 with the shared CHAT_LIMIT_EXCEEDED code — reused, not duplicated.
import { ChatLimitExceededError } from './chatService';
import { enqueueHeavyGeneration, isGenerationPendingStale } from './generationService';

export class ReportNotFoundError extends Error {
  constructor() {
    super('REPORT_NOT_FOUND');
    this.name = 'ReportNotFoundError';
  }
}

export async function getReport(
  env: Pick<Bindings, 'DB' | 'HEAVY_AI_WORKFLOW'>,
  ai: AiDeps,
  id: number,
  userId: string,
): Promise<GetReportResponse> {
  const row = await findAttemptGenerationForUser(env.DB, id, userId);
  if (!row) throw new AttemptNotFoundError(id);
  const { attempt, generation } = row;
  if (attempt.phase !== 'report') throw new ReportNotFoundError();

  const existing = await findReportByAttempt(env.DB, id);
  if (existing) return { status: 'ready', report: existing };

  if (generation.status === 'failed' && generation.kind === 'report') {
    return { status: 'failed', message: generation.error ?? undefined };
  }

  if (generation.status === 'pending' && generation.kind === 'report') {
    if (isGenerationPendingStale(attempt.updatedAt)) {
      await enqueueHeavyGeneration(env, ai, id, 'report', { force: true });
    }
    return { status: 'generating' };
  }

  // Self-heal: report phase claimed but no row and no pending job.
  await enqueueHeavyGeneration(env, ai, id, 'report');
  return { status: 'generating' };
}

/** Attempt-scoped and readable in any phase (empty until questions are asked). */
export async function listQuestions(
  db: D1Database,
  id: number,
  userId: string,
): Promise<ReportMessage[]> {
  await getAttemptForUser(db, id, userId);
  return listReportMessages(db, id);
}

export async function askQuestion(
  env: Pick<Bindings, 'DB' | 'HEAVY_AI_WORKFLOW'>,
  ai: AiDeps,
  id: number,
  userId: string,
  question: string,
  quotedText: string | null,
): Promise<{ userMessage: ReportMessage; assistantMessage: ReportMessage }> {
  const attempt = await getAttemptForUser(env.DB, id, userId);
  assertPhase(attempt, 'report');
  if ((await countUserReportMessages(env.DB, id)) >= REPORT_QA_MESSAGES_MAX) {
    throw new ChatLimitExceededError();
  }
  const reportState = await getReport(env, ai, id, userId);
  if (reportState.status !== 'ready') throw new ReportNotFoundError();
  const challenge = getChallengeContentOrThrow(attempt.challengeId);
  // Snapshot before inserting: the new question goes to the agent separately.
  const history = (await listReportMessages(env.DB, id)).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const userMessage = await insertReportMessage(
    env.DB,
    id,
    'user',
    question,
    quotedText,
    new Date().toISOString(),
  );
  const answer = await answerReportQuestion(ai, {
    challenge,
    reportMd: reportState.report.contentMd,
    quotedText,
    question,
    history,
  });
  const assistantMessage = await insertReportMessage(
    env.DB,
    id,
    'assistant',
    answer,
    null,
    new Date().toISOString(),
  );
  return { userMessage, assistantMessage };
}
