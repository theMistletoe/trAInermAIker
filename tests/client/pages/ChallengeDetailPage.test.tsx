import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import ChallengeDetailPage from '../../../src/client/pages/ChallengeDetailPage';
import { renderWithProviders } from '../../helpers/renderWithProviders';
import { mswServer } from '../../mocks/server';

// 遷移の検証にはページ以外のルートも要るため、routePath ではなく
// <Routes> をテスト側で組み立ててマーカー要素を置く。
const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/challenges/:challengeId" element={<ChallengeDetailPage />} />
      <Route path="/attempts/:attemptId" element={<div data-testid="attempt-route" />} />
      <Route path="/login" element={<div data-testid="login-route" />} />
    </Routes>,
    { initialEntry: '/challenges/todo-app' },
  );

describe('ChallengeDetailPage', () => {
  it('課題仕様の見出しとタイトルが描画される', async () => {
    renderPage();

    expect(await screen.findByTestId('challenge-spec')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '課題概要' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'TODOアプリを作る' })).toBeInTheDocument();
    expect(screen.getByText('frontend')).toBeInTheDocument();
  });

  it('開始ボタンで attempt が作られワークスペースへ遷移する', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('challenge-start-button'));
    expect(await screen.findByTestId('attempt-route')).toBeInTheDocument();
  });

  it('未ログイン(401)で開始するとログインページへ遷移する', async () => {
    mswServer.use(
      http.post('/api/attempts', () =>
        HttpResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('challenge-start-button'));
    expect(await screen.findByTestId('login-route')).toBeInTheDocument();
  });
});
