import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../../src/server/index';
import { signUpAndGetCookie, uniqueEmail } from './authHelper';

const fetchApp = (path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://localhost${path}`, init), env as never);

const postNote = (body: string, cookie?: string) =>
  fetchApp('/api/notes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ body }),
  });

const postNoteId = async (body: string, cookie?: string): Promise<number> => {
  const res = await postNote(body, cookie);
  return ((await res.json()) as { note: { id: number } }).note.id;
};

const deleteNote = (id: number, cookie?: string) =>
  fetchApp(`/api/notes/${id}`, {
    method: 'DELETE',
    ...(cookie ? { headers: { cookie } } : {}),
  });

describe('ノート削除の認可 (DELETE /api/notes/:id)', () => {
  it('未認証は401 UNAUTHORIZEDを返す', async () => {
    const owner = await signUpAndGetCookie(uniqueEmail('owner'));
    const id = await postNoteId('owned note', owner);
    const res = await deleteNote(id);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('UNAUTHORIZED');
  });

  it('他人のノートは403 FORBIDDENを返す', async () => {
    const owner = await signUpAndGetCookie(uniqueEmail('owner'));
    const other = await signUpAndGetCookie(uniqueEmail('other'));
    const id = await postNoteId('owned note', owner);
    const res = await deleteNote(id, other);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe('FORBIDDEN');
  });

  it('匿名ノートはオーナー不在のため誰も削除できない(403)', async () => {
    const user = await signUpAndGetCookie(uniqueEmail('user'));
    const id = await postNoteId('anonymous note');
    const res = await deleteNote(id, user);
    expect(res.status).toBe(403);
  });

  it('所有者は削除でき、以後のGETは404になる', async () => {
    const owner = await signUpAndGetCookie(uniqueEmail('owner'));
    const id = await postNoteId('to be deleted', owner);
    const res = await deleteNote(id, owner);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { deleted: boolean }).deleted).toBe(true);
    const after = await fetchApp(`/api/notes/${id}`);
    expect(after.status).toBe(404);
  });

  it('存在しないノートは404を返す', async () => {
    const owner = await signUpAndGetCookie(uniqueEmail('owner'));
    const res = await deleteNote(999999, owner);
    expect(res.status).toBe(404);
  });
});

describe('自分のノート (GET /api/notes/mine)', () => {
  it('未認証は401 UNAUTHORIZEDを返す', async () => {
    const res = await fetchApp('/api/notes/mine');
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('UNAUTHORIZED');
  });

  it("'mine' は :id ルートを踏まず、INVALID_IDにならない", async () => {
    // Regression guard: /mine must be matched before /:id (both under
    // /api/notes). A wrong order would surface INVALID_ID (400) instead.
    const res = await fetchApp('/api/notes/mine');
    expect(res.status).not.toBe(400);
  });

  it('ログイン中に作成したノートだけが isOwner: true で返る', async () => {
    const owner = await signUpAndGetCookie(uniqueEmail('owner'));
    await postNoteId('mine-1', owner);
    await postNoteId('not-mine');
    const res = await fetchApp('/api/notes/mine', { headers: { cookie: owner } });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { notes: { body: string; isOwner: boolean }[] };
    expect(json.notes.map((n) => n.body)).toEqual(['mine-1']);
    expect(json.notes.every((n) => n.isOwner)).toBe(true);
  });
});

describe('作成時のオーナー刻印 (POST /api/notes)', () => {
  it('ログイン中の作成は isOwner: true で返る', async () => {
    const owner = await signUpAndGetCookie(uniqueEmail('owner'));
    const res = await postNote('owned', owner);
    expect(res.status).toBe(201);
    expect(((await res.json()) as { note: { isOwner: boolean } }).note.isOwner).toBe(true);
  });

  it('他人から見ると isOwner: false になる', async () => {
    const owner = await signUpAndGetCookie(uniqueEmail('owner'));
    const other = await signUpAndGetCookie(uniqueEmail('other'));
    const id = await postNoteId('owned', owner);
    const res = await fetchApp(`/api/notes/${id}`, { headers: { cookie: other } });
    expect(((await res.json()) as { note: { isOwner: boolean } }).note.isOwner).toBe(false);
  });
});
