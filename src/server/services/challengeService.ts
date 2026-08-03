import type { AssessmentQuestion, ChallengeDetail, ChallengeSummary } from '../../shared/schemas';
import { type ChallengeContent, getChallengeContent, listChallengeContents } from '../content';

export class ChallengeNotFoundError extends Error {
  constructor(public id: string) {
    super('CHALLENGE_NOT_FOUND');
    this.name = 'ChallengeNotFoundError';
  }
}

// Explicit projections everywhere: spreading a ChallengeContent would leak the
// secret fields (hiddenSpecMd/rubricMd/personaBrief/learningPoints) to the wire.

export function listChallengeSummaries(): ChallengeSummary[] {
  return listChallengeContents().map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category,
    summary: c.summary,
  }));
}

export function getChallengeDetail(id: string): ChallengeDetail {
  const content = getChallengeContentOrThrow(id);
  return {
    id: content.id,
    title: content.title,
    category: content.category,
    summary: content.summary,
    descriptionMd: content.descriptionMd,
    submissionGuideMd: content.submissionGuideMd,
  };
}

/**
 * Internal service use only: the returned object includes the SECRET fields.
 * Feed it to AI prompts — never to anything that builds a response body.
 */
export function getChallengeContentOrThrow(id: string): ChallengeContent {
  const content = getChallengeContent(id);
  if (!content) throw new ChallengeNotFoundError(id);
  return content;
}

export function getPublicAssessmentQuestions(id: string): AssessmentQuestion[] {
  return getChallengeContentOrThrow(id).assessmentQuestions;
}
