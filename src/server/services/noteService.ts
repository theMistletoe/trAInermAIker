import type { Note } from '../../shared/schemas';
import {
  deleteNote,
  findNote,
  findNoteOwner,
  insertNote,
  listNotes,
  listNotesByOwner,
  setNoteSummary,
} from '../db/queries';
import { type SummarizerDeps, summarizeText } from '../lib/summarizer';

export class NoteNotFoundError extends Error {
  constructor(public id: number) {
    super('NOTE_NOT_FOUND');
    this.name = 'NoteNotFoundError';
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super('FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

// ownerId is the creator's Better Auth user id when signed in, or null for the
// anonymous flow. Ownership is defined solely as "created while signed in" —
// there is no claiming of anonymous notes.
export async function createNote(
  db: D1Database,
  body: string,
  ownerId: string | null = null,
): Promise<Note> {
  // body is already trimmed by the request schema.
  return insertNote(db, body, new Date().toISOString(), ownerId);
}

export async function fetchNotes(db: D1Database, userId: string | null): Promise<Note[]> {
  return listNotes(db, userId);
}

export async function fetchMyNotes(db: D1Database, ownerId: string): Promise<Note[]> {
  return listNotesByOwner(db, ownerId);
}

export async function fetchNote(db: D1Database, id: number, userId: string | null): Promise<Note> {
  const note = await findNote(db, id, userId);
  if (!note) throw new NoteNotFoundError(id);
  return note;
}

/**
 * Generate and persist the AI summary. Deliberately no auth requirement: the
 * summary reveals nothing the note body doesn't, and the anonymous flow is the
 * template's E2E demo path for the AI seam. Failures inside summarizeText
 * degrade to the deterministic stub, so this never throws for AI reasons.
 */
export async function summarizeNote(
  db: D1Database,
  summarizer: SummarizerDeps,
  id: number,
  userId: string | null,
): Promise<Note> {
  const note = await fetchNote(db, id, userId);
  const summary = await summarizeText(summarizer, note.body);
  await setNoteSummary(db, id, summary);
  return fetchNote(db, id, userId);
}

/**
 * Deleting is owner-only: the route returns 401 when anonymous, and a session
 * user who doesn't own the note gets FORBIDDEN here. Anonymous notes have no
 * owner, so nobody may delete them ("created while signed in" is the only
 * source of ownership).
 */
export async function removeNote(db: D1Database, id: number, userId: string): Promise<void> {
  const found = await findNoteOwner(db, id);
  if (!found) throw new NoteNotFoundError(id);
  if (found.ownerId === null || found.ownerId !== userId) throw new ForbiddenError();
  await deleteNote(db, id);
}
