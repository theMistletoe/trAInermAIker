import { act, renderHook, waitFor } from '@testing-library/react';
import { delay, HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { listChatMessages, postChatMessage } from '../../../src/client/api/client';
import { type ChatItem, useChatThread } from '../../../src/client/hooks/useChatThread';
import type { ChatMessage } from '../../../src/shared/schemas';
import {
  listChatMessagesResponseSchema,
  postChatResponseSchema,
} from '../../../src/shared/schemas';
import { buildChatMessage } from '../../mocks/factories';
import { mswServer } from '../../mocks/server';

const toItem = (m: ChatMessage): ChatItem => ({
  key: `msg-${m.id}`,
  role: m.role,
  content: m.content,
  quotedText: null,
  pending: false,
});

// 実 API クライアント + MSW 経由で load/send を組み立てる(vi.mock 禁止)。
const deps = {
  load: async () => (await listChatMessages(1)).messages.map(toItem),
  send: async (content: string) => {
    const res = await postChatMessage(1, content);
    return [toItem(res.userMessage), toItem(res.assistantMessage)];
  },
};

describe('useChatThread', () => {
  it('マウント時に load が走り messages が埋まる', async () => {
    const { result } = renderHook(() => useChatThread(deps));
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.messages.map((m) => m.role)).toEqual(['assistant']);
  });

  it('send は楽観的 pending エントリを追加し、成功後にサーバー行で置換する', async () => {
    mswServer.use(
      http.post('/api/attempts/:id/chat', async ({ request }) => {
        const body = (await request.json()) as { message: string };
        await delay(60);
        return HttpResponse.json(
          postChatResponseSchema.parse({
            userMessage: buildChatMessage({ id: 10, role: 'user', content: body.message }),
            assistantMessage: buildChatMessage({ id: 11, content: '了解しました。' }),
          }),
        );
      }),
    );
    const { result } = renderHook(() => useChatThread(deps));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let sendPromise!: Promise<boolean>;
    act(() => {
      sendPromise = result.current.send('締切はいつですか？');
    });

    // delay(60) の間に楽観的エントリが観測できる。
    await waitFor(() => {
      expect(result.current.messages.some((m) => m.pending)).toBe(true);
    });
    const optimistic = result.current.messages.at(-1);
    expect(optimistic?.key).toMatch(/^optimistic-/);
    expect(optimistic?.role).toBe('user');
    expect(optimistic?.content).toBe('締切はいつですか？');
    expect(result.current.sending).toBe(true);

    let ok = false;
    await act(async () => {
      ok = await sendPromise;
    });
    expect(ok).toBe(true);
    expect(result.current.sending).toBe(false);
    expect(result.current.messages.map((m) => m.key)).toEqual(['msg-1', 'msg-10', 'msg-11']);
    expect(result.current.messages.every((m) => !m.pending)).toBe(true);
  });

  it('send 失敗時は楽観的エントリを取り除き false を返す', async () => {
    mswServer.use(
      http.post('/api/attempts/:id/chat', () =>
        HttpResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useChatThread(deps));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let ok = true;
    await act(async () => {
      ok = await result.current.send('失敗するメッセージ');
    });
    expect(ok).toBe(false);
    expect(result.current.messages.map((m) => m.key)).toEqual(['msg-1']);
    expect(result.current.sending).toBe(false);
  });

  it('送信中の send は無視され false を返す(楽観的エントリも増えない)', async () => {
    mswServer.use(
      http.post('/api/attempts/:id/chat', async ({ request }) => {
        const body = (await request.json()) as { message: string };
        await delay(60);
        return HttpResponse.json(
          postChatResponseSchema.parse({
            userMessage: buildChatMessage({ id: 10, role: 'user', content: body.message }),
            assistantMessage: buildChatMessage({ id: 11, content: '了解しました。' }),
          }),
        );
      }),
    );
    const { result } = renderHook(() => useChatThread(deps));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let firstPromise!: Promise<boolean>;
    act(() => {
      firstPromise = result.current.send('一通目');
    });
    await waitFor(() => {
      expect(result.current.sending).toBe(true);
    });

    let second = true;
    await act(async () => {
      second = await result.current.send('二通目');
    });
    expect(second).toBe(false);
    // 二通目の楽観的エントリは追加されない。
    expect(result.current.messages.filter((m) => m.pending)).toHaveLength(1);

    let first = false;
    await act(async () => {
      first = await firstPromise;
    });
    expect(first).toBe(true);
    expect(result.current.messages.map((m) => m.content)).toEqual([
      'こんにちは。作りたいものについて質問してください。',
      '一通目',
      '了解しました。',
    ]);
  });

  it('reload で再 load され、差し替えたハンドラの内容に置き換わる', async () => {
    const { result } = renderHook(() => useChatThread(deps));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mswServer.use(
      http.get('/api/attempts/:id/chat', () =>
        HttpResponse.json(
          listChatMessagesResponseSchema.parse({
            messages: [buildChatMessage({ id: 2, content: '再読込後のメッセージ' })],
          }),
        ),
      ),
    );
    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(result.current.messages.map((m) => m.content)).toEqual(['再読込後のメッセージ']);
    });
  });
});
