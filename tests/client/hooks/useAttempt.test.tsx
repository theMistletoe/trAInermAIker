import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../src/client/api/client';
import { useAttempt } from '../../../src/client/hooks/useAttempt';
import { getAttemptResponseSchema } from '../../../src/shared/schemas';
import { buildAttempt } from '../../mocks/factories';
import { mswServer } from '../../mocks/server';

describe('useAttempt', () => {
  it('マウント直後は loading、取得成功で ready + attempt が入る', async () => {
    const { result } = renderHook(() => useAttempt(5));
    expect(result.current.state.status).toBe('loading');

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    const state = result.current.state;
    if (state.status !== 'ready') throw new Error('unreachable');
    expect(state.attempt.id).toBe(5);
    expect(state.attempt.phase).toBe('assessment');
  });

  it('500 のとき error 状態になり、エラーオブジェクトが state に残る', async () => {
    mswServer.use(
      http.get('/api/attempts/:id', () =>
        HttpResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useAttempt(1));

    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });
    const state = result.current.state;
    if (state.status !== 'error') throw new Error('unreachable');
    expect(state.error).toBeInstanceOf(ApiError);
    expect((state.error as ApiError).status).toBe(500);
  });

  it('refresh で再フェッチされ、差し替えたハンドラの内容が反映される', async () => {
    const { result } = renderHook(() => useAttempt(1));
    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });

    mswServer.use(
      http.get('/api/attempts/:id', () =>
        HttpResponse.json(
          getAttemptResponseSchema.parse({ attempt: buildAttempt({ id: 1, phase: 'submission' }) }),
        ),
      ),
    );
    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      const state = result.current.state;
      expect(state.status === 'ready' && state.attempt.phase).toBe('submission');
    });
  });

  it('applyAttempt はネットワークなしで state を ready に更新する', async () => {
    const { result } = renderHook(() => useAttempt(1));
    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });

    // ハンドラを 500 に差し替えても applyAttempt は fetch しないので影響を受けない。
    mswServer.use(
      http.get('/api/attempts/:id', () =>
        HttpResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 }),
      ),
    );
    act(() => {
      result.current.applyAttempt(buildAttempt({ id: 1, phase: 'qa' }));
    });

    const state = result.current.state;
    if (state.status !== 'ready') throw new Error('unreachable');
    expect(state.attempt.phase).toBe('qa');
  });
});
