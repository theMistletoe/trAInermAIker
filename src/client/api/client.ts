import { hc } from 'hono/client';
import type { z } from 'zod';
import type { AppType } from '../../server';
import {
  type AdvanceAttemptResponse,
  type AnswerQaResponse,
  type ApiErrorCode,
  type AskReportResponse,
  advanceAttemptResponseSchema,
  answerQaResponseSchema,
  apiErrorBodySchema,
  askReportResponseSchema,
  type CreateAttemptResponse,
  createAttemptResponseSchema,
  type GetAssessmentResponse,
  type GetAttemptResponse,
  type GetChallengeResponse,
  type GetReportResponse,
  type GetSubmissionFileResponse,
  type GetSubmissionResponse,
  getAssessmentResponseSchema,
  getAttemptResponseSchema,
  getChallengeResponseSchema,
  getReportResponseSchema,
  getSubmissionFileResponseSchema,
  getSubmissionResponseSchema,
  type ListChallengesResponse,
  type ListChatMessagesResponse,
  type ListMyAttemptsResponse,
  type ListQaResponse,
  type ListReportMessagesResponse,
  listChallengesResponseSchema,
  listChatMessagesResponseSchema,
  listMyAttemptsResponseSchema,
  listQaResponseSchema,
  listReportMessagesResponseSchema,
  type PostChatResponse,
  postChatResponseSchema,
  type RegenerateResponse,
  regenerateResponseSchema,
  type SubmitAssessmentResponse,
  submitAssessmentResponseSchema,
  type UploadSubmissionResponse,
  uploadSubmissionResponseSchema,
} from '../../shared/schemas';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ApiError';
  }
}

const client = hc<AppType>('/');

// hc returns `ClientResponse`, which is structurally close to `Response` but
// not assignable in either direction once @cloudflare/workers-types is in
// scope. Accept a minimal structural shape so both work.
interface JsonResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

async function toApiError(res: JsonResponseLike): Promise<ApiError> {
  try {
    const body = await res.json();
    const parsed = apiErrorBodySchema.safeParse(body);
    if (parsed.success) {
      return new ApiError(res.status, parsed.data.error, parsed.data.message);
    }
  } catch {
    // body was not JSON; fall through to the generic case.
  }
  return new ApiError(res.status, 'INTERNAL_ERROR');
}

async function parseResponse<T extends z.ZodTypeAny>(
  res: JsonResponseLike,
  schema: T,
): Promise<z.infer<T>> {
  if (!res.ok) throw await toApiError(res);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, 'INVALID_RESPONSE');
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    // The server returned a 2xx whose body doesn't match the shared contract —
    // either the schema or the handler drifted. Surface this as a distinct
    // code so callers can distinguish it from real server errors.
    throw new ApiError(res.status, 'INVALID_RESPONSE', parsed.error.message);
  }
  return parsed.data;
}

// --- challenges (public catalogue) ---

export async function listChallenges(): Promise<ListChallengesResponse> {
  const res = await client.api.challenges.$get();
  return parseResponse(res, listChallengesResponseSchema);
}

export async function getChallenge(id: string): Promise<GetChallengeResponse> {
  const res = await client.api.challenges[':id'].$get({ param: { id } });
  return parseResponse(res, getChallengeResponseSchema);
}

// --- attempts (all endpoints require a session; throw ApiError(401) when signed out) ---

export async function createAttempt(challengeId: string): Promise<CreateAttemptResponse> {
  const res = await client.api.attempts.$post({ json: { challengeId } });
  return parseResponse(res, createAttemptResponseSchema);
}

export async function listMyAttempts(): Promise<ListMyAttemptsResponse> {
  const res = await client.api.attempts.mine.$get();
  return parseResponse(res, listMyAttemptsResponseSchema);
}

export async function getAttempt(id: number): Promise<GetAttemptResponse> {
  const res = await client.api.attempts[':id'].$get({ param: { id: String(id) } });
  return parseResponse(res, getAttemptResponseSchema);
}

export async function getAssessment(id: number): Promise<GetAssessmentResponse> {
  const res = await client.api.attempts[':id'].assessment.$get({ param: { id: String(id) } });
  return parseResponse(res, getAssessmentResponseSchema);
}

export async function submitAssessment(
  id: number,
  answers: { questionId: string; value: string }[],
): Promise<SubmitAssessmentResponse> {
  const res = await client.api.attempts[':id'].assessment.$post({
    param: { id: String(id) },
    json: { answers },
  });
  return parseResponse(res, submitAssessmentResponseSchema);
}

export async function listChatMessages(id: number): Promise<ListChatMessagesResponse> {
  const res = await client.api.attempts[':id'].chat.$get({ param: { id: String(id) } });
  return parseResponse(res, listChatMessagesResponseSchema);
}

export async function postChatMessage(id: number, message: string): Promise<PostChatResponse> {
  const res = await client.api.attempts[':id'].chat.$post({
    param: { id: String(id) },
    json: { message },
  });
  return parseResponse(res, postChatResponseSchema);
}

export async function advanceAttempt(id: number): Promise<AdvanceAttemptResponse> {
  const res = await client.api.attempts[':id'].advance.$post({ param: { id: String(id) } });
  return parseResponse(res, advanceAttemptResponseSchema);
}

export async function regenerateGeneration(
  id: number,
  kind: 'qa' | 'report',
): Promise<RegenerateResponse> {
  const res = await client.api.attempts[':id'].regenerate.$post({
    param: { id: String(id) },
    json: { kind },
  });
  return parseResponse(res, regenerateResponseSchema);
}

export async function uploadSubmission(id: number, file: File): Promise<UploadSubmissionResponse> {
  const res = await client.api.attempts[':id'].submission.$post({
    param: { id: String(id) },
    form: { file },
  });
  return parseResponse(res, uploadSubmissionResponseSchema);
}

export async function getSubmission(id: number): Promise<GetSubmissionResponse> {
  const res = await client.api.attempts[':id'].submission.$get({ param: { id: String(id) } });
  return parseResponse(res, getSubmissionResponseSchema);
}

export async function getSubmissionFile(
  id: number,
  path: string,
): Promise<GetSubmissionFileResponse> {
  const res = await client.api.attempts[':id'].submission.file.$get({
    param: { id: String(id) },
    query: { path },
  });
  return parseResponse(res, getSubmissionFileResponseSchema);
}

export async function listQa(id: number): Promise<ListQaResponse> {
  const res = await client.api.attempts[':id'].qa.$get({ param: { id: String(id) } });
  return parseResponse(res, listQaResponseSchema);
}

export async function answerQa(id: number, answer: string): Promise<AnswerQaResponse> {
  const res = await client.api.attempts[':id'].qa.answer.$post({
    param: { id: String(id) },
    json: { answer },
  });
  return parseResponse(res, answerQaResponseSchema);
}

export async function getReport(id: number): Promise<GetReportResponse> {
  const res = await client.api.attempts[':id'].report.$get({ param: { id: String(id) } });
  return parseResponse(res, getReportResponseSchema);
}

export async function listReportMessages(id: number): Promise<ListReportMessagesResponse> {
  const res = await client.api.attempts[':id'].report.questions.$get({
    param: { id: String(id) },
  });
  return parseResponse(res, listReportMessagesResponseSchema);
}

export async function askReportQuestion(
  id: number,
  question: string,
  quotedText: string | null,
): Promise<AskReportResponse> {
  const res = await client.api.attempts[':id'].report.questions.$post({
    param: { id: String(id) },
    json: { question, quotedText },
  });
  return parseResponse(res, askReportResponseSchema);
}
