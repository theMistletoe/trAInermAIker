import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ServiceIntro } from '../../../src/client/components/ServiceIntro';
import { MESSAGES } from '../../../src/shared/messages';
import { attemptPhaseEnum } from '../../../src/shared/schemas';
import { renderWithProviders } from '../../helpers/renderWithProviders';

describe('ServiceIntro', () => {
  it('ヒーローに見出し・リード・CTAを表示する', () => {
    renderWithProviders(<ServiceIntro />);

    expect(screen.getByRole('heading', { name: MESSAGES.landing.heroTitle })).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.landing.heroLead)).toBeInTheDocument();

    const cta = screen.getByTestId('landing-cta');
    expect(cta).toHaveAttribute('href', '#challenges');
    expect(cta).toHaveTextContent(MESSAGES.landing.ctaChallenges);
    expect(screen.getByTestId('landing-signup')).toHaveAttribute('href', '/signup');
  });

  it('5つのフェーズをラベル・説明つきで進行順に表示する', () => {
    renderWithProviders(<ServiceIntro />);

    const flow = screen.getByTestId('landing-flow');
    for (const phase of attemptPhaseEnum.options) {
      const item = within(flow).getByTestId(`landing-phase-${phase}`);
      expect(item).toHaveTextContent(MESSAGES.attempt.phaseLabels[phase]);
      expect(item).toHaveTextContent(MESSAGES.landing.phaseDescriptions[phase]);
    }

    const order = within(flow)
      .getAllByRole('listitem')
      .map((item) => item.getAttribute('data-testid'));
    expect(order).toEqual(attemptPhaseEnum.options.map((phase) => `landing-phase-${phase}`));
  });

  it('大切にしていること3点を表示する', () => {
    renderWithProviders(<ServiceIntro />);

    const features = [
      [MESSAGES.landing.featureElicitTitle, MESSAGES.landing.featureElicitBody],
      [MESSAGES.landing.featureBuildTitle, MESSAGES.landing.featureBuildBody],
      [MESSAGES.landing.featureVerifyTitle, MESSAGES.landing.featureVerifyBody],
    ] as const;
    for (const [title, body] of features) {
      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.getByText(body)).toBeInTheDocument();
    }
  });
});
