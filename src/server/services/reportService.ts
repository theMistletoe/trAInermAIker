import { REPORT_QA_MESSAGES_MAX } from '../../shared/constants';
import type { Report, ReportMessage } from '../../shared/schemas';
import { listChatMessages } from '../db/chatMessages';
import { listQaQuestions } from '../db/qa';
import {
  countUserReportMessages,
  findReportByAttempt,
  insertReport,
  insertReportMessage,
  listReportMessages,
} from '../db/reports';
import { findSubmissionByAttempt, listSubmissionFileContents } from '../db/submissions';
import { answerReportQuestion, generateReport } from '../lib/agent';
import type { AiDeps } from '../lib/ai';
import { assertPhase, getAttemptForUser } from './attemptService';
import { getChallengeContentOrThrow } from './challengeService';
// 1:1 with the shared CHAT_LIMIT_EXCEEDED code — reused, not duplicated.
import { ChatLimitExceededError } from './chatService';

export class ReportNotFoundError extends Error {
  constructor() {
    super('REPORT_NOT_FOUND');
    this.name = 'ReportNotFoundError';
  }
}

export async function getReport(
  db: D1Database,
  ai: AiDeps,
  id: number,
  userId: string,
): Promise<Report> {
  const attempt = await getAttemptForUser(db, id, userId);
  if (attempt.phase !== 'report') throw new ReportNotFoundError();
  const existing = await findReportByAttempt(db, id);
  if (existing) return existing;
  // Self-heal: advanceAttempt CAS-claimed the report phase but crashed before
  // inserting the report. Generation never throws (stub fallback).
  const submission = await findSubmissionByAttempt(db, id);
  const qaPairs = (await listQaQuestions(db, id)).map((q) => ({
    category: q.category,
    question: q.question,
    answer: q.answer ?? '',
  }));
  const contentMd = await generateReport(ai, {
    challenge: getChallengeContentOrThrow(attempt.challengeId),
    skillProfile: attempt.skillProfile,
    chatHistory: (await listChatMessages(db, id)).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    submissionFiles: submission ? await listSubmissionFileContents(db, submission.id) : [],
    qaPairs,
  });
  await insertReport(db, id, contentMd, new Date().toISOString());
  const report = await findReportByAttempt(db, id);
  if (!report) throw new ReportNotFoundError();
  return report;
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
  db: D1Database,
  ai: AiDeps,
  id: number,
  userId: string,
  question: string,
  quotedText: string | null,
): Promise<{ userMessage: ReportMessage; assistantMessage: ReportMessage }> {
  const attempt = await getAttemptForUser(db, id, userId);
  assertPhase(attempt, 'report');
  if ((await countUserReportMessages(db, id)) >= REPORT_QA_MESSAGES_MAX) {
    throw new ChatLimitExceededError();
  }
  // Loads contentMd up front, healing a missing report row on the way.
  const report = await getReport(db, ai, id, userId);
  const challenge = getChallengeContentOrThrow(attempt.challengeId);
  // Snapshot before inserting: the new question goes to the agent separately.
  const history = (await listReportMessages(db, id)).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const userMessage = await insertReportMessage(
    db,
    id,
    'user',
    question,
    quotedText,
    new Date().toISOString(),
  );
  const answer = await answerReportQuestion(ai, {
    challenge,
    reportMd: report.contentMd,
    quotedText,
    question,
    history,
  });
  const assistantMessage = await insertReportMessage(
    db,
    id,
    'assistant',
    answer,
    null,
    new Date().toISOString(),
  );
  return { userMessage, assistantMessage };
}
