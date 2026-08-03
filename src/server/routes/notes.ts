import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import {
  createNoteBodySchema,
  createNoteResponseSchema,
  deleteNoteResponseSchema,
  getNoteResponseSchema,
  listMyNotesResponseSchema,
  listNotesResponseSchema,
  noteIdParamSchema,
  summarizeNoteResponseSchema,
} from '../../shared/schemas';
import { getSessionUser } from '../auth';
import { errorBody } from '../lib/errors';
import { summarizerDepsFromEnv } from '../lib/summarizer';
import {
  createNote,
  ForbiddenError,
  fetchMyNotes,
  fetchNote,
  fetchNotes,
  NoteNotFoundError,
  removeNote,
  summarizeNote,
} from '../services/noteService';
import type { Bindings } from '../types';

const mapNoteError = (e: unknown) => {
  if (e instanceof NoteNotFoundError)
    return { code: 'NOTE_NOT_FOUND' as const, status: 404 as const };
  if (e instanceof ForbiddenError) return { code: 'FORBIDDEN' as const, status: 403 as const };
  return null;
};

export const notesRoute = new Hono<{ Bindings: Bindings }>()
  .post(
    '/',
    zValidator('json', createNoteBodySchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_BODY'), 400);
    }),
    async (c) => {
      const { body } = c.req.valid('json');
      // Stamp ownership only when the creator is signed in; anonymous creation
      // is a first-class flow (owner_id stays null).
      const user = await getSessionUser(c.env, c.req.raw.headers);
      try {
        const note = await createNote(c.env.DB, body, user?.id ?? null);
        return c.json(createNoteResponseSchema.parse({ note }), 201);
      } catch (e) {
        console.error('createNote failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .get('/', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers);
    try {
      const notes = await fetchNotes(c.env.DB, user?.id ?? null);
      return c.json(listNotesResponseSchema.parse({ notes }));
    } catch (e) {
      console.error('fetchNotes failed', e);
      return c.json(errorBody('INTERNAL_ERROR'), 500);
    }
  })
  // Registered before '/:id' so the static path wins over the param route.
  .get('/mine', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers);
    if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
    const notes = await fetchMyNotes(c.env.DB, user.id);
    return c.json(listMyNotesResponseSchema.parse({ notes }));
  })
  .get(
    '/:id',
    zValidator('param', noteIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    async (c) => {
      const { id } = c.req.valid('param');
      const user = await getSessionUser(c.env, c.req.raw.headers);
      try {
        const note = await fetchNote(c.env.DB, id, user?.id ?? null);
        return c.json(getNoteResponseSchema.parse({ note }));
      } catch (e) {
        const mapped = mapNoteError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('fetchNote failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .post(
    '/:id/summarize',
    zValidator('param', noteIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    async (c) => {
      const { id } = c.req.valid('param');
      const user = await getSessionUser(c.env, c.req.raw.headers);
      try {
        const note = await summarizeNote(
          c.env.DB,
          summarizerDepsFromEnv(c.env),
          id,
          user?.id ?? null,
        );
        return c.json(summarizeNoteResponseSchema.parse({ note }));
      } catch (e) {
        const mapped = mapNoteError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('summarizeNote failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  )
  .delete(
    '/:id',
    zValidator('param', noteIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    async (c) => {
      const { id } = c.req.valid('param');
      const user = await getSessionUser(c.env, c.req.raw.headers);
      if (!user) return c.json(errorBody('UNAUTHORIZED'), 401);
      try {
        await removeNote(c.env.DB, id, user.id);
        return c.json(deleteNoteResponseSchema.parse({ deleted: true }));
      } catch (e) {
        const mapped = mapNoteError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('removeNote failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  );
