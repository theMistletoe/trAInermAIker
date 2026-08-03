import { hc } from 'hono/client';
import type { z } from 'zod';
import type { AppType } from '../../server';
import {
  type ApiErrorCode,
  apiErrorBodySchema,
  type CreateNoteResponse,
  createNoteResponseSchema,
  type DeleteNoteResponse,
  deleteNoteResponseSchema,
  type GetNoteResponse,
  getNoteResponseSchema,
  type ListMyNotesResponse,
  type ListNotesResponse,
  listMyNotesResponseSchema,
  listNotesResponseSchema,
  type SummarizeNoteResponse,
  summarizeNoteResponseSchema,
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

export async function listNotes(): Promise<ListNotesResponse> {
  const res = await client.api.notes.$get();
  return parseResponse(res, listNotesResponseSchema);
}

export async function createNote(body: string): Promise<CreateNoteResponse> {
  const res = await client.api.notes.$post({ json: { body } });
  return parseResponse(res, createNoteResponseSchema);
}

// Auth is carried by the Better Auth session cookie (sent same-origin); no
// header wiring needed. Throws ApiError(401, 'UNAUTHORIZED') when signed out.
export async function listMyNotes(): Promise<ListMyNotesResponse> {
  const res = await client.api.notes.mine.$get();
  return parseResponse(res, listMyNotesResponseSchema);
}

export async function getNote(id: number): Promise<GetNoteResponse> {
  const res = await client.api.notes[':id'].$get({ param: { id: String(id) } });
  return parseResponse(res, getNoteResponseSchema);
}

export async function summarizeNote(id: number): Promise<SummarizeNoteResponse> {
  const res = await client.api.notes[':id'].summarize.$post({ param: { id: String(id) } });
  return parseResponse(res, summarizeNoteResponseSchema);
}

export async function deleteNote(id: number): Promise<DeleteNoteResponse> {
  const res = await client.api.notes[':id'].$delete({ param: { id: String(id) } });
  return parseResponse(res, deleteNoteResponseSchema);
}
