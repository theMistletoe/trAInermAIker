import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { usePollingNotes } from '../../../src/client/hooks/usePollingNotes';
import { listNotesResponseSchema } from '../../../src/shared/schemas';
import { buildNote } from '../../mocks/factories';
import { mswServer } from '../../mocks/server';

describe('usePollingNotes', () => {
  it('マウント直後は loading、ポーリング成功で ready + notes が反映される', async () => {
    const { result } = renderHook(() => usePollingNotes());
    expect(result.current.state.status).toBe('loading');

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    expect(result.current.state.notes.map((n) => n.body)).toEqual(['sample note']);
  });

  it('ハンドラを差し替えると次のポーリングで内容が丸ごと置換される', async () => {
    const { result } = renderHook(() => usePollingNotes());
    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });

    mswServer.use(
      http.get('/api/notes', () =>
        HttpResponse.json(
          listNotesResponseSchema.parse({ notes: [buildNote({ id: 2, body: '更新後のノート' })] }),
        ),
      ),
    );

    await waitFor(() => {
      expect(result.current.state.notes.map((n) => n.body)).toEqual(['更新後のノート']);
    });
  });

  it('ポーリングが失敗すると error になり、直前の notes を保持する', async () => {
    const { result } = renderHook(() => usePollingNotes());
    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });

    mswServer.use(
      http.get('/api/notes', () => HttpResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })),
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });
    // 直前に取得できていた一覧は消えない。
    expect(result.current.state.notes.map((n) => n.body)).toEqual(['sample note']);
  });

  it('enabled=false のとき fetch を発生させない', async () => {
    // onUnhandledRequest:'error' 環境で、リクエストが飛べばこのテストは失敗する。
    // ここでは念のためハンドラ自体を外し、「呼ばれない」ことを成功で証明する。
    mswServer.use(
      http.get('/api/notes', () => {
        throw new Error('fetch should not happen when enabled=false');
      }),
    );
    const { result } = renderHook(() => usePollingNotes(false));
    await new Promise((r) => setTimeout(r, 80));
    expect(result.current.state.status).toBe('loading');
    expect(result.current.state.notes).toEqual([]);
  });
});
