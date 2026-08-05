import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { ZIP_MAX_BYTES } from '../../shared/constants';
import {
  advanceAttemptResponseSchema,
  answerQaBodySchema,
  answerQaResponseSchema,
  askReportBodySchema,
  askReportResponseSchema,
  attemptIdParamSchema,
  createAttemptBodySchema,
  createAttemptResponseSchema,
  getAssessmentResponseSchema,
  getAttemptResponseSchema,
  getReportResponseSchema,
  getSubmissionFileResponseSchema,
  getSubmissionResponseSchema,
  listChatMessagesResponseSchema,
  listMyAttemptsResponseSchema,
  listQaResponseSchema,
  listReportMessagesResponseSchema,
  postChatBodySchema,
  postChatResponseSchema,
  regenerateBodySchema,
  regenerateResponseSchema,
  submissionFileQuerySchema,
  submissionFormSchema,
  submitAssessmentBodySchema,
  submitAssessmentResponseSchema,
  uploadSubmissionResponseSchema,
} from '../../shared/schemas';
import { getSessionUser } from '../auth';
import { aiDepsFromEnv } from '../lib/ai';
import { errorBody } from '../lib/errors';
import {
  getAssessment,
  InvalidAssessmentError,
  submitAssessment,
} from '../services/assessmentService';
import {
  AttemptNotFoundError,
  advanceAttempt,
  ChatRequiredError,
  createOrGetAttempt,
  getAttemptForUser,
  InvalidPhaseError,
  listMyAttempts,
  QaIncompleteError,
  SubmissionRequiredError,
} from '../services/attemptService';
import { ChallengeNotFoundError } from '../services/challengeService';
import { ChatLimitExceededError, listMessages, postMessage } from '../services/chatService';
import { answerQuestion, getQaState, QaCompletedError } from '../services/qaService';
import { regenerateHeavyGeneration } from '../services/regenerateService';
import {
  askQuestion,
  getReport,
  listQuestions,
  ReportNotFoundError,
} from '../services/reportService';
import {
  getSubmission,
  getSubmissionFile,
  InvalidZipError,
  SubmissionFileNotFoundError,
  SubmissionNotFoundError,
  uploadSubmission,
  ZipTooLargeError,
} from '../services/submissionService';
import type { Bindings } from '../types';

const mapAttemptError = (e: unknown) => {
  if (e instanceof AttemptNotFoundError)
    return { code: 'ATTEMPT_NOT_FOUND' as const, status: 404 as const };
  if (e instanceof ChallengeNotFoundError)
    return { code: 'CHALLENGE_NOT_FOUND' as const, status: 404 as const };
  if (e instanceof InvalidPhaseError)
    return { code: 'INVALID_PHASE' as const, status: 409 as const };
  if (e instanceof InvalidAssessmentError)
    return { code: 'INVALID_ASSESSMENT' as const, status: 400 as const };
  if (e instanceof ChatRequiredError)
    return { code: 'CHAT_REQUIRED' as const, status: 409 as const };
  if (e instanceof SubmissionRequiredError)
    return { code: 'SUBMISSION_REQUIRED' as const, status: 409 as const };
  if (e instanceof QaIncompleteError)
    return { code: 'QA_INCOMPLETE' as const, status: 409 as const };
  if (e instanceof ChatLimitExceededError)
    return { code: 'CHAT_LIMIT_EXCEEDED' as const, status: 409 as const };
  if (e instanceof QaCompletedError) return { code: 'QA_COMPLETED' as const, status: 409 as const };
  if (e instanceof SubmissionNotFoundError)
    return { code: 'SUBMISSION_NOT_FOUND' as const, status: 404 as const };
  if (e instanceof SubmissionFileNotFoundError)
    return { code: 'SUBMISSION_FILE_NOT_FOUND' as const, status: 404 as const };
  if (e instanceof InvalidZipError) return { code: 'INVALID_ZIP' as const, status: 400 as const };
  if (e instanceof ZipTooLargeError)
    return { code: 'ZIP_TOO_LARGE' as const, status: 413 as const };
  if (e instanceof ReportNotFoundError)
    return { code: 'REPORT_NOT_FOUND' as const, status: 404 as const };
  return null;
};

export const attemptsRoute = new Hono<{ Bindings: Bindings }>()
  .post(
    '/',
    zValidator('json', createAttemptBodySchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_BODY'), 400);
    }),
    async (c) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      const { challengeId } = c.req.valid('json');
      try {
        const { attempt, created } = await createOrGetAttempt(c.env.DB, user.id, challengeId);
        return c.json(createAttemptResponseSchema.parse({ attempt }), created ? 201 : 200);
      } catch (e) {
        const mapped = mapAttemptError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('createOrGetAttempt failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  // Registered before '/:id' so the static path wins over the param route.
  .get('/mine', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers);
    if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
    try {
      const attempts = await listMyAttempts(c.env.DB, user.id);
      return c.json(listMyAttemptsResponseSchema.parse({ attempts }), 200);
    } catch (e) {
      const mapped = mapAttemptError(e);
      if (mapped) return c.json(errorBody(mapped.code), mapped.status);
      console.error('listMyAttempts failed', e);
      return c.json(errorBody('INTERNAL_ERROR'), 500);
    }
  })
  .get(
    '/:id',
    zValidator('param', attemptIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    async (c) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      const { id } = c.req.valid('param');
      try {
        const attempt = await getAttemptForUser(c.env.DB, id, user.id);
        return c.json(getAttemptResponseSchema.parse({ attempt }), 200);
      } catch (e) {
        const mapped = mapAttemptError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('getAttemptForUser failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .get(
    '/:id/assessment',
    zValidator('param', attemptIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    async (c) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      const { id } = c.req.valid('param');
      try {
        const { questions, answers } = await getAssessment(c.env.DB, id, user.id);
        return c.json(getAssessmentResponseSchema.parse({ questions, answers }), 200);
      } catch (e) {
        const mapped = mapAttemptError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('getAssessment failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .post(
    '/:id/assessment',
    zValidator('param', attemptIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    zValidator('json', submitAssessmentBodySchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_BODY'), 400);
    }),
    async (c) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      const { id } = c.req.valid('param');
      const { answers } = c.req.valid('json');
      const ai = aiDepsFromEnv(c.env);
      try {
        const attempt = await submitAssessment(c.env.DB, ai, id, user.id, answers);
        return c.json(submitAssessmentResponseSchema.parse({ attempt }), 200);
      } catch (e) {
        const mapped = mapAttemptError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('submitAssessment failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .get(
    '/:id/chat',
    zValidator('param', attemptIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    async (c) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      const { id } = c.req.valid('param');
      try {
        const messages = await listMessages(c.env.DB, id, user.id);
        return c.json(listChatMessagesResponseSchema.parse({ messages }), 200);
      } catch (e) {
        const mapped = mapAttemptError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('listMessages failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .post(
    '/:id/chat',
    zValidator('param', attemptIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    zValidator('json', postChatBodySchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_BODY'), 400);
    }),
    async (c) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      const { id } = c.req.valid('param');
      const { message } = c.req.valid('json');
      const ai = aiDepsFromEnv(c.env);
      try {
        const { userMessage, assistantMessage } = await postMessage(
          c.env.DB,
          ai,
          id,
          user.id,
          message,
        );
        return c.json(postChatResponseSchema.parse({ userMessage, assistantMessage }), 200);
      } catch (e) {
        const mapped = mapAttemptError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('postMessage failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .post(
    '/:id/advance',
    zValidator('param', attemptIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    async (c) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      const { id } = c.req.valid('param');
      const ai = aiDepsFromEnv(c.env);
      try {
        const attempt = await advanceAttempt(c.env, ai, id, user.id);
        return c.json(advanceAttemptResponseSchema.parse({ attempt }), 200);
      } catch (e) {
        const mapped = mapAttemptError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('advanceAttempt failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .post(
    '/:id/regenerate',
    zValidator('param', attemptIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    zValidator('json', regenerateBodySchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_BODY'), 400);
    }),
    async (c) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      const { id } = c.req.valid('param');
      const { kind } = c.req.valid('json');
      const ai = aiDepsFromEnv(c.env);
      try {
        const attempt = await regenerateHeavyGeneration(c.env, ai, id, user.id, kind);
        return c.json(regenerateResponseSchema.parse({ attempt }), 200);
      } catch (e) {
        const mapped = mapAttemptError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('regenerateHeavyGeneration failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .post(
    '/:id/submission',
    zValidator('param', attemptIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    // Auth gate BEFORE any body handling: without this, an anonymous client's
    // multipart body would be fully buffered by the form validator just to be
    // rejected. The handler's own 401 check below stays for uniformity.
    async (c, next) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      await next();
    },
    // Header-level size gate BEFORE the form validator buffers the multipart
    // body (the authoritative check on file.size stays in the service; a
    // chunked request without content-length passes here and is caught there).
    // The slack covers multipart boundary/field overhead.
    async (c, next) => {
      const contentLength = Number(c.req.header('content-length') ?? '0');
      if (contentLength > ZIP_MAX_BYTES + 64 * 1024) {
        return c.json(errorBody('ZIP_TOO_LARGE'), 413);
      }
      await next();
    },
    zValidator('form', submissionFormSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_BODY'), 400);
    }),
    async (c) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      const { id } = c.req.valid('param');
      const { file } = c.req.valid('form');
      try {
        const submission = await uploadSubmission(c.env.DB, c.env.SUBMISSIONS, id, user.id, file);
        return c.json(uploadSubmissionResponseSchema.parse({ submission }), 201);
      } catch (e) {
        const mapped = mapAttemptError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('uploadSubmission failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .get(
    '/:id/submission',
    zValidator('param', attemptIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    async (c) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      const { id } = c.req.valid('param');
      try {
        const submission = await getSubmission(c.env.DB, id, user.id);
        return c.json(getSubmissionResponseSchema.parse({ submission }), 200);
      } catch (e) {
        const mapped = mapAttemptError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('getSubmission failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .get(
    '/:id/submission/file',
    zValidator('param', attemptIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    zValidator('query', submissionFileQuerySchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    async (c) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      const { id } = c.req.valid('param');
      const { path } = c.req.valid('query');
      try {
        const file = await getSubmissionFile(c.env.DB, id, user.id, path);
        return c.json(getSubmissionFileResponseSchema.parse({ file }), 200);
      } catch (e) {
        const mapped = mapAttemptError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('getSubmissionFile failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .get(
    '/:id/qa',
    zValidator('param', attemptIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    async (c) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      const { id } = c.req.valid('param');
      const ai = aiDepsFromEnv(c.env);
      try {
        const state = await getQaState(c.env, ai, id, user.id);
        return c.json(listQaResponseSchema.parse(state), 200);
      } catch (e) {
        const mapped = mapAttemptError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('getQaState failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .post(
    '/:id/qa/answer',
    zValidator('param', attemptIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    zValidator('json', answerQaBodySchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_BODY'), 400);
    }),
    async (c) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      const { id } = c.req.valid('param');
      const { answer } = c.req.valid('json');
      try {
        const { answered, next, remaining } = await answerQuestion(c.env.DB, id, user.id, answer);
        return c.json(answerQaResponseSchema.parse({ answered, next, remaining }), 200);
      } catch (e) {
        const mapped = mapAttemptError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('answerQuestion failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .get(
    '/:id/report',
    zValidator('param', attemptIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    async (c) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      const { id } = c.req.valid('param');
      const ai = aiDepsFromEnv(c.env);
      try {
        const state = await getReport(c.env, ai, id, user.id);
        return c.json(getReportResponseSchema.parse(state), 200);
      } catch (e) {
        const mapped = mapAttemptError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('getReport failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .get(
    '/:id/report/questions',
    zValidator('param', attemptIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    async (c) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      const { id } = c.req.valid('param');
      try {
        const messages = await listQuestions(c.env.DB, id, user.id);
        return c.json(listReportMessagesResponseSchema.parse({ messages }), 200);
      } catch (e) {
        const mapped = mapAttemptError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('listQuestions failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .post(
    '/:id/report/questions',
    zValidator('param', attemptIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    zValidator('json', askReportBodySchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_BODY'), 400);
    }),
    async (c) => {
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      const { id } = c.req.valid('param');
      const { question, quotedText } = c.req.valid('json');
      const ai = aiDepsFromEnv(c.env);
      try {
        const { userMessage, assistantMessage } = await askQuestion(
          c.env,
          ai,
          id,
          user.id,
          question,
          quotedText,
        );
        return c.json(askReportResponseSchema.parse({ userMessage, assistantMessage }), 200);
      } catch (e) {
        const mapped = mapAttemptError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('askQuestion failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  );
