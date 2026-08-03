import type { AssessmentQuestion } from '../../shared/schemas';

/**
 * A challenge definition. Lives in code (not D1) so the secret fields stay
 * structurally unreachable from any API response schema, and content fixes are
 * normal deploys instead of append-only migrations.
 */
export interface ChallengeContent {
  /** URL-safe slug, e.g. 'aws-cdk-file-sharing'. Referenced by attempts.challenge_id. */
  id: string;
  title: string;
  category: string;
  /** 1-2 sentence card text for the list page. */
  summary: string;
  /** PUBLIC: short problem statement shown before starting (markdown). */
  descriptionMd: string;
  /**
   * SECRET: the full requirement spec (functional/auth/scale/security/... and
   * deliverables). Fed only to AI prompts; must never reach the wire.
   */
  hiddenSpecMd: string;
  /** SECRET: evaluation rubric used by the QA generator and report writer. */
  rubricMd: string;
  /** SECRET: character sheet for the requirement-chat stakeholder persona. */
  personaBrief: string;
  /** SECRET: key learning topics the QA generator should probe. */
  learningPoints: string[];
  /** Fixed skill-check questions answered in the assessment phase. */
  assessmentQuestions: AssessmentQuestion[];
}
