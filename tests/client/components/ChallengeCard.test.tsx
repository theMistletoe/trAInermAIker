import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChallengeCard } from '../../../src/client/components/ChallengeCard';
import { renderWithProviders } from '../../helpers/renderWithProviders';
import { buildChallengeSummary } from '../../mocks/factories';

describe('ChallengeCard', () => {
  it('カテゴリ・タイトル・概要を表示する', () => {
    const challenge = buildChallengeSummary();
    renderWithProviders(<ChallengeCard challenge={challenge} />);

    const card = screen.getByTestId('challenge-card');
    expect(card).toHaveTextContent(challenge.category);
    expect(card).toHaveTextContent(challenge.title);
    expect(card).toHaveTextContent(challenge.summary);
  });

  it('課題詳細へのリンクになっている', () => {
    renderWithProviders(<ChallengeCard challenge={buildChallengeSummary({ id: 'todo-app' })} />);
    expect(screen.getByTestId('challenge-card')).toHaveAttribute('href', '/challenges/todo-app');
  });
});
