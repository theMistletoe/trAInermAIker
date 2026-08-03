import { z } from 'zod';
import { NOTE_BODY_MAX, NOTE_BODY_MIN } from './constants';

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

// --- Error schemas ---

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
]);

export const apiErrorBodySchema = z.object({
  // Unknown server-emitted codes are coerced to INTERNAL_ERROR rather than
  // failing the parse — keeps the client resilient to schema drift on the
  // error path itself.
  error: apiErrorCodeEnum.catch('INTERNAL_ERROR'),
  message: z.string().optional(),
});

// --- Inferred types (single source of truth for both client and server) ---

export type Note = z.infer<typeof noteSchema>;
export type CreateNoteResponse = z.infer<typeof createNoteResponseSchema>;
export type GetNoteResponse = z.infer<typeof getNoteResponseSchema>;
export type ListNotesResponse = z.infer<typeof listNotesResponseSchema>;
export type ListMyNotesResponse = z.infer<typeof listMyNotesResponseSchema>;
export type SummarizeNoteResponse = z.infer<typeof summarizeNoteResponseSchema>;
export type DeleteNoteResponse = z.infer<typeof deleteNoteResponseSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeEnum>;
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
