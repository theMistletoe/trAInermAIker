import type { AssessmentAnswer, AssessmentQuestion, Attempt } from '../../shared/schemas';
import { insertAssessmentAnswers, listAssessmentAnswers } from '../db/assessmentAnswers';
import { setSkillProfileAndPhase } from '../db/attempts';
import { evaluateAssessment } from '../lib/agent';
import type { AiDeps } from '../lib/ai';
import { assertPhase, getAttemptForUser, InvalidPhaseError } from './attemptService';
import { getChallengeContentOrThrow, getPublicAssessmentQuestions } from './challengeService';

export class InvalidAssessmentError extends Error {
  constructor() {
    super('INVALID_ASSESSMENT');
    this.name = 'InvalidAssessmentError';
  }
}

/** Readable in any phase: answers are simply empty until submitted. */
export async function getAssessment(
  db: D1Database,
  id: number,
  userId: string,
): Promise<{ questions: AssessmentQuestion[]; answers: AssessmentAnswer[] }> {
  const attempt = await getAttemptForUser(db, id, userId);
  return {
    questions: getPublicAssessmentQuestions(attempt.challengeId),
    answers: await listAssessmentAnswers(db, id),
  };
}

function validateAnswers(
  questions: AssessmentQuestion[],
  answers: { questionId: string; value: string }[],
): void {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const seen = new Set<string>();
  for (const answer of answers) {
    const question = byId.get(answer.questionId);
    if (!question || seen.has(answer.questionId)) throw new InvalidAssessmentError();
    seen.add(answer.questionId);
    // free_text needs no value check here: the body schema already trims and
    // enforces non-empty.
    if (question.kind === 'single_choice') {
      const choices = question.choices ?? [];
      if (!choices.some((c) => c.id === answer.value)) throw new InvalidAssessmentError();
    }
  }
  if (seen.size !== questions.length) throw new InvalidAssessmentError();
}

export async function submitAssessment(
  db: D1Database,
  ai: AiDeps,
  id: number,
  userId: string,
  answers: { questionId: string; value: string }[],
): Promise<Attempt> {
  const attempt = await getAttemptForUser(db, id, userId);
  assertPhase(attempt, 'assessment');
  const challenge = getChallengeContentOrThrow(attempt.challengeId);
  validateAnswers(challenge.assessmentQuestions, answers);
  const now = new Date().toISOString();
  await insertAssessmentAnswers(db, id, answers, now);
  const profile = await evaluateAssessment(ai, { challenge, answers });
  const advanced = await setSkillProfileAndPhase(
    db,
    id,
    profile,
    'assessment',
    'requirement_chat',
    new Date().toISOString(),
  );
  if (!advanced) throw new InvalidPhaseError();
  return getAttemptForUser(db, id, userId);
}
