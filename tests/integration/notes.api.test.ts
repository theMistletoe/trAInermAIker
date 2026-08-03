import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../../src/server/index';

const fetchApp = (path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://localhost${path}`, init), env as never);

const postNote = (body: string) =>
  fetchApp('/api/notes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body }),
  });

const postNoteId = async (body: string): Promise<number> => {
  const res = await postNote(body);
  return ((await res.json()) as { note: { id: number } }).note.id;
};

const getBodies = async (): Promise<string[]> => {
  const res = await fetchApp('/api/notes');
  const json = (await res.json()) as { notes: { body: string }[] };
  return json.notes.map((n) => n.body);
};

describe('ノートの作成 (POST /api/notes)', () => {
  it('ノートを作成して返す（匿名: summary=null / isOwner=false）', async () => {
    const res = await postNote('first note');
    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      note: { id: number; body: string; summary: string | null; isOwner: boolean };
    };
    expect(json.note.body).toBe('first note');
    expect(json.note.summary).toBeNull();
    expect(json.note.isOwner).toBe(false);
    expect(json.note.id).toBeGreaterThan(0);
  });

  it('前後の空白をトリムする', async () => {
    const res = await postNote('  hello  ');
    const json = (await res.json()) as { note: { body: string } };
    expect(json.note.body).toBe('hello');
  });

  it('空のbodyに対して400を返す', async () => {
    const res = await postNote('');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_BODY');
  });

  it('空白文字のみのbodyに対して400を返す', async () => {
    const res = await postNote('   \n\t  ');
    expect(res.status).toBe(400);
  });

  it('2000文字を超えるbodyに対して400を返す', async () => {
    const res = await postNote('a'.repeat(2001));
    expect(res.status).toBe(400);
  });
});

describe('ノート一覧 (GET /api/notes)', () => {
  it('新しい順（id降順）で返す', async () => {
    // Rows created by earlier tests in this file are NOT rolled back between
    // tests in this pool setup (same caveat as authHelper's user rows), so
    // assert on the head of the list — the three newest ids — instead of the
    // whole table.
    await postNote('a');
    await postNote('b');
    await postNote('c');
    expect((await getBodies()).slice(0, 3)).toEqual(['c', 'b', 'a']);
  });
});

describe('ノート単体 (GET /api/notes/:id)', () => {
  it('存在するノートを返す', async () => {
    const id = await postNoteId('single note');
    const res = await fetchApp(`/api/notes/${id}`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { note: { id: number; body: string } };
    expect(json.note.id).toBe(id);
    expect(json.note.body).toBe('single note');
  });

  it('存在しないidに対して404 NOTE_NOT_FOUNDを返す', async () => {
    const res = await fetchApp('/api/notes/999999');
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('NOTE_NOT_FOUND');
  });

  it('数値でないidに対して400 INVALID_IDを返す', async () => {
    const res = await fetchApp('/api/notes/abc');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_ID');
  });
});

describe('ノートの要約 (POST /api/notes/:id/summarize)', () => {
  it('AI_STUB下では空白正規化された決定的サマリが保存される', async () => {
    const id = await postNoteId('これは   テスト用の  ノートです');
    const res = await fetchApp(`/api/notes/${id}/summarize`, { method: 'POST' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { note: { summary: string | null } };
    expect(json.note.summary).toBe('これは テスト用の ノートです');

    // The summary is persisted, not just echoed.
    const after = await fetchApp(`/api/notes/${id}`);
    const afterJson = (await after.json()) as { note: { summary: string | null } };
    expect(afterJson.note.summary).toBe('これは テスト用の ノートです');
  });

  it('存在しないidに対して404を返す', async () => {
    const res = await fetchApp('/api/notes/999999/summarize', { method: 'POST' });
    expect(res.status).toBe(404);
  });
});

describe('未定義パスのハンドリング (app.notFound)', () => {
  it('未定義の/apiパスに対してAPI_NOT_FOUNDを返す', async () => {
    const res = await fetchApp('/api/does/not/exist');
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('API_NOT_FOUND');
  });
});
