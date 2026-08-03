import { NOTES_PAGE_LIMIT } from '../../shared/constants';
import type { Note } from '../../shared/schemas';

interface NoteRow {
  id: number;
  body: string;
  summary: string | null;
  created_at: string;
  owner_id: string | null;
}

// isOwner is computed against the requesting user here so owner_id itself
// never leaves the db layer (and never hits the wire).
const toNote = (r: NoteRow, userId: string | null): Note => ({
  id: r.id,
  body: r.body,
  summary: r.summary,
  createdAt: r.created_at,
  isOwner: userId !== null && r.owner_id === userId,
});

export async function insertNote(
  db: D1Database,
  body: string,
  createdAt: string,
  ownerId: string | null,
): Promise<Note> {
  const row = await db
    .prepare(
      'INSERT INTO notes (body, created_at, owner_id) VALUES (?1, ?2, ?3) RETURNING id, body, summary, created_at, owner_id',
    )
    .bind(body, createdAt, ownerId)
    .first<NoteRow>();
  if (!row) throw new Error('insertNote: no row returned');
  return toNote(row, ownerId);
}

/** All notes, newest first (id DESC). */
export async function listNotes(db: D1Database, userId: string | null): Promise<Note[]> {
  const { results } = await db
    .prepare('SELECT id, body, summary, created_at, owner_id FROM notes ORDER BY id DESC LIMIT ?1')
    .bind(NOTES_PAGE_LIMIT)
    .all<NoteRow>();
  return results.map((r) => toNote(r, userId));
}

/** Notes created by `ownerId` (newest first). */
export async function listNotesByOwner(db: D1Database, ownerId: string): Promise<Note[]> {
  const { results } = await db
    .prepare(
      'SELECT id, body, summary, created_at, owner_id FROM notes WHERE owner_id = ?1 ORDER BY id DESC LIMIT ?2',
    )
    .bind(ownerId, NOTES_PAGE_LIMIT)
    .all<NoteRow>();
  return results.map((r) => toNote(r, ownerId));
}

export async function findNote(
  db: D1Database,
  id: number,
  userId: string | null,
): Promise<Note | null> {
  const row = await db
    .prepare('SELECT id, body, summary, created_at, owner_id FROM notes WHERE id = ?1')
    .bind(id)
    .first<NoteRow>();
  return row ? toNote(row, userId) : null;
}

/** Owner lookup for authorization checks (owner_id stays server-side). */
export async function findNoteOwner(
  db: D1Database,
  id: number,
): Promise<{ ownerId: string | null } | null> {
  const row = await db
    .prepare('SELECT owner_id FROM notes WHERE id = ?1')
    .bind(id)
    .first<{ owner_id: string | null }>();
  return row ? { ownerId: row.owner_id } : null;
}

export async function setNoteSummary(
  db: D1Database,
  id: number,
  summary: string,
): Promise<boolean> {
  const res = await db
    .prepare('UPDATE notes SET summary = ?2 WHERE id = ?1')
    .bind(id, summary)
    .run();
  return res.meta.changes > 0;
}

export async function deleteNote(db: D1Database, id: number): Promise<boolean> {
  const res = await db.prepare('DELETE FROM notes WHERE id = ?1').bind(id).run();
  return res.meta.changes > 0;
}
