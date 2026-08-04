import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import ChallengeListPage from '../../../src/client/pages/ChallengeListPage';
import { MESSAGES } from '../../../src/shared/messages';
import { listChallengesResponseSchema } from '../../../src/shared/schemas';
import { renderWithProviders } from '../../helpers/renderWithProviders';
import { mswServer } from '../../mocks/server';

describe('ChallengeListPage', () => {
  it('デフォルトハンドラの課題がカードとして描画される', async () => {
    renderWithProviders(<ChallengeListPage />);

    const cards = await screen.findAllByTestId('challenge-card');
    expect(cards).toHaveLength(2);
    expect(screen.getByText('TODOアプリを作る')).toBeInTheDocument();
    expect(screen.getByText('ブログ API を設計する')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: MESSAGES.challenge.listTitle })).toBeInTheDocument();
  });

  it('課題が空のとき空表示を出す', async () => {
    mswServer.use(
      http.get('/api/challenges', () =>
        HttpResponse.json(listChallengesResponseSchema.parse({ challenges: [] })),
      ),
    );
    renderWithProviders(<ChallengeListPage />);

    expect(await screen.findByTestId('challenge-list-empty')).toHaveTextContent(
      MESSAGES.challenge.empty,
    );
    expect(screen.queryByTestId('challenge-card')).not.toBeInTheDocument();
  });

  it('取得に失敗したときエラーメッセージを表示する', async () => {
    mswServer.use(
      http.get('/api/challenges', () =>
        HttpResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 }),
      ),
    );
    renderWithProviders(<ChallengeListPage />);

    expect(await screen.findByText(MESSAGES.challenge.listFailed)).toBeInTheDocument();
  });
});
