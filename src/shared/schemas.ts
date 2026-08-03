import { z } from 'zod';
import { ASSESSMENT_ANSWER_MAX, CHAT_MESSAGE_MAX, NOTE_BODY_MAX, NOTE_BODY_MIN } from './constants';

// =========================================================================
// notes (template sample slice — scheduled for removal)
// =========================================================================

// --- Request schemas ---

export const createNoteBodySchema = z.object({
  body: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(NOTE_BODY_MIN, 'INVALID_BODY').max(NOTE_BODY_MAX, 'INVALID_BODY')),
});

export const noteIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// --- Entity schemas ---

export const noteSchema = z.object({
  id: z.number().int().nonnegative(),
  body: z.string(),
  // AI-generated summary. Nullable (never optional) so the wire shape stays
  // stable under exactOptionalPropertyTypes: null until summarized.
  summary: z.string().nullable(),
  createdAt: z.string(),
  // Whether the requesting session user owns this note. Computed server-side
  // from the session; ownerId itself is intentionally never exposed on the wire.
  isOwner: z.boolean(),
});

// --- Response schemas ---

export const createNoteResponseSchema = z.object({ note: noteSchema });
export const getNoteResponseSchema = z.object({ note: noteSchema });
export const listNotesResponseSchema = z.object({ notes: z.array(noteSchema) });
export const listMyNotesResponseSchema = z.object({ notes: z.array(noteSchema) });
export const summarizeNoteResponseSchema = z.object({ note: noteSchema });
export const deleteNoteResponseSchema = z.object({ deleted: z.literal(true) });

// =========================================================================
// challenges (public catalogue)
// =========================================================================

export const challengeIdParamSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'INVALID_ID'),
});

export const challengeSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  summary: z.string(),
});

// Public detail projection. The full requirement spec / rubric / persona brief
// deliberately have no schema here: they must never reach the wire.
export const challengeDetailSchema = challengeSummarySchema.extend({
  descriptionMd: z.string(),
  // Deliverable format / technical constraints (shown in the submission phase).
  submissionGuideMd: z.string(),
});

export const listChallengesResponseSchema = z.object({
  challenges: z.array(challengeSummarySchema),
});
export const getChallengeResponseSchema = z.object({ challenge: challengeDetailSchema });

// =========================================================================
// attempts (phase state machine)
// =========================================================================

export const attemptPhaseEnum = z.enum([
  'assessment',
  'requirement_chat',
  'submission',
  'qa',
  'report',
]);

export const skillLevelEnum = z.enum(['none', 'beginner', 'intermediate', 'advanced']);

export const skillProfileSchema = z.object({
  overallLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  dimensions: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      level: skillLevelEnum,
      note: z.string(),
    }),
  ),
  summary: z.string(),
});

export const attemptSchema = z.object({
  id: z.number().int().positive(),
  challengeId: z.string(),
  phase: attemptPhaseEnum,
  // Set once the assessment phase completes; referenced by all later AI phases.
  skillProfile: skillProfileSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const attemptIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createAttemptBodySchema = z.object({
  challengeId: z.string().regex(/^[a-z0-9-]+$/, 'INVALID_BODY'),
});

export const createAttemptResponseSchema = z.object({ attempt: attemptSchema });
export const getAttemptResponseSchema = z.object({ attempt: attemptSchema });
export const listMyAttemptsResponseSchema = z.object({ attempts: z.array(attemptSchema) });
export const advanceAttemptResponseSchema = z.object({ attempt: attemptSchema });

// =========================================================================
// assessment (skill check)
// =========================================================================

export const assessmentQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  kind: z.enum(['single_choice', 'free_text']),
  // Present for single_choice, null for free_text.
  choices: z.array(z.object({ id: z.string(), label: z.string() })).nullable(),
});

export const assessmentAnswerSchema = z.object({
  questionId: z.string(),
  value: z.string(),
});

export const submitAssessmentBodySchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1, 'INVALID_BODY'),
        value: z
          .string()
          .transform((v) => v.trim())
          .pipe(z.string().min(1, 'INVALID_BODY').max(ASSESSMENT_ANSWER_MAX, 'INVALID_BODY')),
      }),
    )
    .min(1, 'INVALID_BODY'),
});

export const getAssessmentResponseSchema = z.object({
  questions: z.array(assessmentQuestionSchema),
  answers: z.array(assessmentAnswerSchema),
});
export const submitAssessmentResponseSchema = z.object({ attempt: attemptSchema });

// =========================================================================
// requirement chat
// =========================================================================

export const chatMessageSchema = z.object({
  id: z.number().int().positive(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: z.string(),
});

export const postChatBodySchema = z.object({
  message: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, 'INVALID_BODY').max(CHAT_MESSAGE_MAX, 'INVALID_BODY')),
});

export const listChatMessagesResponseSchema = z.object({
  messages: z.array(chatMessageSchema),
});
export const postChatResponseSchema = z.object({
  userMessage: chatMessageSchema,
  assistantMessage: chatMessageSchema,
});

// =========================================================================
// submission (zip upload)
// =========================================================================

export const submissionFileMetaSchema = z.object({
  path: z.string(),
  size: z.number().int().nonnegative(),
  isTruncated: z.boolean(),
});

export const submissionSchema = z.object({
  id: z.number().int().positive(),
  zipName: z.string(),
  zipSize: z.number().int().nonnegative(),
  entryCount: z.number().int().nonnegative(),
  textFileCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  files: z.array(submissionFileMetaSchema),
});

// zValidator('form', ...) schema. File is a global in Workers, browsers, jsdom
// and Node 20+, so this shared module stays portable.
export const submissionFormSchema = z.object({
  file: z.instanceof(File),
});

export const submissionFileQuerySchema = z.object({
  path: z.string().min(1, 'INVALID_ID'),
});

export const uploadSubmissionResponseSchema = z.object({ submission: submissionSchema });
export const getSubmissionResponseSchema = z.object({ submission: submissionSchema });
export const getSubmissionFileResponseSchema = z.object({
  file: z.object({
    path: z.string(),
    size: z.number().int().nonnegative(),
    content: z.string(),
    isTruncated: z.boolean(),
  }),
});

// =========================================================================
// qa (dynamic follow-up questions)
// =========================================================================

export const qaCategoryEnum = z.enum(['gap', 'unasked_requirement', 'learning_point', 'growth']);

export const qaQuestionSchema = z.object({
  id: z.number().int().positive(),
  questionNo: z.number().int().positive(),
  category: qaCategoryEnum,
  question: z.string(),
  answer: z.string().nullable(),
  answeredAt: z.string().nullable(),
});

export const answerQaBodySchema = z.object({
  answer: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, 'INVALID_BODY').max(CHAT_MESSAGE_MAX, 'INVALID_BODY')),
});

export const listQaResponseSchema = z.object({
  questions: z.array(qaQuestionSchema),
  done: z.boolean(),
});
export const answerQaResponseSchema = z.object({
  answered: qaQuestionSchema,
  next: qaQuestionSchema.nullable(),
  remaining: z.number().int().nonnegative(),
});

// =========================================================================
// report (+ follow-up Q&A)
// =========================================================================

export const reportSchema = z.object({
  contentMd: z.string(),
  createdAt: z.string(),
});

export const reportMessageSchema = z.object({
  id: z.number().int().positive(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  // Report excerpt the user selected when asking (user messages only).
  quotedText: z.string().nullable(),
  createdAt: z.string(),
});

export const askReportBodySchema = z.object({
  question: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, 'INVALID_BODY').max(CHAT_MESSAGE_MAX, 'INVALID_BODY')),
  quotedText: z.string().max(CHAT_MESSAGE_MAX, 'INVALID_BODY').nullable(),
});

export const getReportResponseSchema = z.object({ report: reportSchema });
export const listReportMessagesResponseSchema = z.object({
  messages: z.array(reportMessageSchema),
});
export const askReportResponseSchema = z.object({
  userMessage: reportMessageSchema,
  assistantMessage: reportMessageSchema,
});

// =========================================================================
// Error schemas
// =========================================================================

export const apiErrorCodeEnum = z.enum([
  'NOTE_NOT_FOUND',
  'API_NOT_FOUND',
  'INVALID_BODY',
  'INVALID_ID',
  'UNAUTHORIZED',
  // Signed in, but not the owner of the target note (incl. anonymous notes,
  // which have no owner and can never be deleted).
  'FORBIDDEN',
  'INTERNAL_ERROR',
  // Client-side: raised when a 2xx response fails to match its declared
  // response schema (i.e. server drifted from the shared contract).
  'INVALID_RESPONSE',
  // --- challenges / attempts (each 1:1 with a service error class) ---
  'CHALLENGE_NOT_FOUND',
  // Also returned for attempts owned by another user (existence is hidden).
  'ATTEMPT_NOT_FOUND',
  // The attempt is not in the phase this operation requires (409).
  'INVALID_PHASE',
  // Assessment answers don't match the challenge's question set.
  'INVALID_ASSESSMENT',
  // Advance guards (409): each names the unmet prerequisite.
  'CHAT_REQUIRED',
  'SUBMISSION_REQUIRED',
  'QA_INCOMPLETE',
  'CHAT_LIMIT_EXCEEDED',
  'QA_COMPLETED',
  'SUBMISSION_NOT_FOUND',
  'SUBMISSION_FILE_NOT_FOUND',
  'INVALID_ZIP',
  'ZIP_TOO_LARGE',
  'REPORT_NOT_FOUND',
]);

export const apiErrorBodySchema = z.object({
  // Unknown server-emitted codes are coerced to INTERNAL_ERROR rather than
  // failing the parse — keeps the client resilient to schema drift on the
  // error path itself.
  error: apiErrorCodeEnum.catch('INTERNAL_ERROR'),
  message: z.string().optional(),
});

// =========================================================================
// Inferred types (single source of truth for both client and server)
// =========================================================================

export type Note = z.infer<typeof noteSchema>;
export type CreateNoteResponse = z.infer<typeof createNoteResponseSchema>;
export type GetNoteResponse = z.infer<typeof getNoteResponseSchema>;
export type ListNotesResponse = z.infer<typeof listNotesResponseSchema>;
export type ListMyNotesResponse = z.infer<typeof listMyNotesResponseSchema>;
export type SummarizeNoteResponse = z.infer<typeof summarizeNoteResponseSchema>;
export type DeleteNoteResponse = z.infer<typeof deleteNoteResponseSchema>;

export type ChallengeSummary = z.infer<typeof challengeSummarySchema>;
export type ChallengeDetail = z.infer<typeof challengeDetailSchema>;
export type ListChallengesResponse = z.infer<typeof listChallengesResponseSchema>;
export type GetChallengeResponse = z.infer<typeof getChallengeResponseSchema>;

export type AttemptPhase = z.infer<typeof attemptPhaseEnum>;
export type SkillLevel = z.infer<typeof skillLevelEnum>;
export type SkillProfile = z.infer<typeof skillProfileSchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type CreateAttemptResponse = z.infer<typeof createAttemptResponseSchema>;
export type GetAttemptResponse = z.infer<typeof getAttemptResponseSchema>;
export type ListMyAttemptsResponse = z.infer<typeof listMyAttemptsResponseSchema>;
export type AdvanceAttemptResponse = z.infer<typeof advanceAttemptResponseSchema>;

export type AssessmentQuestion = z.infer<typeof assessmentQuestionSchema>;
export type AssessmentAnswer = z.infer<typeof assessmentAnswerSchema>;
export type GetAssessmentResponse = z.infer<typeof getAssessmentResponseSchema>;
export type SubmitAssessmentResponse = z.infer<typeof submitAssessmentResponseSchema>;

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ListChatMessagesResponse = z.infer<typeof listChatMessagesResponseSchema>;
export type PostChatResponse = z.infer<typeof postChatResponseSchema>;

export type SubmissionFileMeta = z.infer<typeof submissionFileMetaSchema>;
export type Submission = z.infer<typeof submissionSchema>;
export type UploadSubmissionResponse = z.infer<typeof uploadSubmissionResponseSchema>;
export type GetSubmissionResponse = z.infer<typeof getSubmissionResponseSchema>;
export type GetSubmissionFileResponse = z.infer<typeof getSubmissionFileResponseSchema>;

export type QaCategory = z.infer<typeof qaCategoryEnum>;
export type QaQuestion = z.infer<typeof qaQuestionSchema>;
export type ListQaResponse = z.infer<typeof listQaResponseSchema>;
export type AnswerQaResponse = z.infer<typeof answerQaResponseSchema>;

export type Report = z.infer<typeof reportSchema>;
export type ReportMessage = z.infer<typeof reportMessageSchema>;
export type GetReportResponse = z.infer<typeof getReportResponseSchema>;
export type ListReportMessagesResponse = z.infer<typeof listReportMessagesResponseSchema>;
export type AskReportResponse = z.infer<typeof askReportResponseSchema>;

export type ApiErrorCode = z.infer<typeof apiErrorCodeEnum>;
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
