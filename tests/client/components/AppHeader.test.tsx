import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { AppHeader } from '../../../src/client/components/AppHeader';
import { authClient } from '../../../src/client/lib/authClient';
import { renderWithProviders } from '../../helpers/renderWithProviders';
import { mswServer } from '../../mocks/server';

// better-auth の useSession はモジュールレベルの nanostores アトムに載っており、
// 直前のテストが取得したセッションがテスト間で残る（アンマウント後も約1秒は
// 破棄されない）。ハンドラ差し替え後にセッションシグナルを立てて再フェッチを
// 強制し、このテストのハンドラの結果で上書きさせる。
const refetchSession = () =>
  act(() => {
    authClient.$store.notify('$sessionSignal');
  });

// Better Auth の get-session が返すログイン済みレスポンスの最小形。
const signedInSession = {
  session: {
    id: 'session-1',
    token: 'token-1',
    userId: 'user-1',
    expiresAt: '2999-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  user: {
    id: 'user-1',
    email: 'user@example.com',
    name: 'テストユーザー',
    emailVerified: false,
    image: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

describe('AppHeader', () => {
  it('匿名のときメニューにログインとサインアップを表示する', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);
    refetchSession();

    await user.click(screen.getByTestId('nav-menu'));
    expect(await screen.findByTestId('nav-login')).toBeInTheDocument();
    expect(screen.getByTestId('nav-signup')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-logout')).not.toBeInTheDocument();
  });

  it('ログイン済みのときメニューにログアウトのみを表示する', async () => {
    mswServer.use(http.get('/api/auth/get-session', () => HttpResponse.json(signedInSession)));
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);
    refetchSession();

    await user.click(screen.getByTestId('nav-menu'));
    expect(await screen.findByTestId('nav-logout')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-login')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-signup')).not.toBeInTheDocument();
  });

  it('メニュー外クリックと Escape でパネルが閉じる', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    // 外側クリックで閉じる
    await user.click(screen.getByTestId('nav-menu'));
    expect(screen.getByTestId('nav-menu-panel')).toBeInTheDocument();
    await user.click(document.body);
    await waitFor(() => {
      expect(screen.queryByTestId('nav-menu-panel')).not.toBeInTheDocument();
    });

    // Escape で閉じる
    await user.click(screen.getByTestId('nav-menu'));
    expect(screen.getByTestId('nav-menu-panel')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByTestId('nav-menu-panel')).not.toBeInTheDocument();
    });
  });
});
