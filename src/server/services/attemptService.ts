import type { Attempt, AttemptPhase, ChatMessage } from '../../shared/schemas';
import {
  findAttemptByUserAndChallenge,
  findAttemptForUser,
  insertAttempt,
  listAttemptsByUser,
  updateAttemptPhase,
} from '../db/attempts';
import { countUserChatMessages, listChatMessages } from '../db/chatMessages';
import { countQaQuestions, insertQaQuestions, listQaQuestions } from '../db/qa';
import { findReportByAttempt, insertReport } from '../db/reports';
import { findSubmissionByAttempt, listSubmissionFileContents } from '../db/submissions';
import { type ChatTurn, generateQaQuestions, generateReport } from '../lib/agent';
import type { AiDeps } from '../lib/ai';
import { getChallengeContentOrThrow } from './challengeService';

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

function toChatTurns(messages: ChatMessage[]): ChatTurn[] {
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

export async function advanceAttempt(
  db: D1Database,
  ai: AiDeps,
  id: number,
  userId: string,
): Promise<Attempt> {
  const attempt = await getAttemptForUser(db, id, userId);
  const now = new Date().toISOString();
  switch (attempt.phase) {
    case 'assessment':
    case 'report':
      // assessment advances only through submitAssessment; report is terminal.
      throw new InvalidPhaseError();
    case 'requirement_chat': {
      if ((await countUserChatMessages(db, id)) < 1) throw new ChatRequiredError();
      if (!(await updateAttemptPhase(db, id, 'requirement_chat', 'submission', now))) {
        throw new InvalidPhaseError();
      }
      break;
    }
    case 'submission': {
      const submission = await findSubmissionByAttempt(db, id);
      if (!submission) throw new SubmissionRequiredError();
      // CAS first so exactly one request becomes the QA generator. Generation
      // never throws (stub fallback); a crash between the CAS and the insert
      // leaves zero questions, which qaService.getQaState self-heals.
      if (!(await updateAttemptPhase(db, id, 'submission', 'qa', now))) {
        throw new InvalidPhaseError();
      }
      const questions = await generateQaQuestions(ai, {
        challenge: getChallengeContentOrThrow(attempt.challengeId),
        skillProfile: attempt.skillProfile,
        chatHistory: toChatTurns(await listChatMessages(db, id)),
        submissionFiles: await listSubmissionFileContents(db, submission.id),
      });
      await insertQaQuestions(db, id, questions, new Date().toISOString());
      break;
    }
    case 'qa': {
      const { total, unanswered } = await countQaQuestions(db, id);
      if (total === 0 || unanswered > 0) throw new QaIncompleteError();
      if (!(await updateAttemptPhase(db, id, 'qa', 'report', now))) {
        throw new InvalidPhaseError();
      }
      if (!(await findReportByAttempt(db, id))) {
        const submission = await findSubmissionByAttempt(db, id);
        const qaPairs = (await listQaQuestions(db, id)).map((q) => ({
          category: q.category,
          question: q.question,
          answer: q.answer ?? '',
        }));
        const contentMd = await generateReport(ai, {
          challenge: getChallengeContentOrThrow(attempt.challengeId),
          skillProfile: attempt.skillProfile,
          chatHistory: toChatTurns(await listChatMessages(db, id)),
          submissionFiles: submission ? await listSubmissionFileContents(db, submission.id) : [],
          qaPairs,
        });
        await insertReport(db, id, contentMd, new Date().toISOString());
      }
      break;
    }
  }
  return getAttemptForUser(db, id, userId);
}
