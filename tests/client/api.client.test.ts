import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError, getNote, listNotes } from '../../src/client/api/client';
import { mswServer } from '../mocks/server';

describe('APIクライアント (parseResponse 経由の契約ガード)', () => {
  it('listNotes: デフォルトハンドラで notes 配列が返る', async () => {
    const res = await listNotes();
    expect(res.notes).toHaveLength(1);
    expect(res.notes[0]?.body).toBe('sample note');
  });

  it('2xx なのに契約不一致のボディは INVALID_RESPONSE の ApiError を投げる', async () => {
    mswServer.use(http.get('/api/notes', () => HttpResponse.json({ wrong: true })));
    const err = await listNotes().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('INVALID_RESPONSE');
  });

  it('404 + NOTE_NOT_FOUND はステータスとコードを保持した ApiError になる', async () => {
    mswServer.use(
      http.get('/api/notes/:id', () =>
        HttpResponse.json({ error: 'NOTE_NOT_FOUND' }, { status: 404 }),
      ),
    );
    const err = await getNote(999).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).code).toBe('NOTE_NOT_FOUND');
  });

  it('500 + 未知のエラーコードは INTERNAL_ERROR に吸収される', async () => {
    mswServer.use(
      http.get('/api/notes', () => HttpResponse.json({ error: '??' }, { status: 500 })),
    );
    const err = await listNotes().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('INTERNAL_ERROR');
  });
});
