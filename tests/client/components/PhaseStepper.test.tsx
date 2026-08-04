import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhaseStepper } from '../../../src/client/components/PhaseStepper';
import { MESSAGES } from '../../../src/shared/messages';
import { attemptPhaseEnum } from '../../../src/shared/schemas';
import { renderWithProviders } from '../../helpers/renderWithProviders';

describe('PhaseStepper', () => {
  it('current より前は done、current は current + aria-current、後は upcoming になる', () => {
    renderWithProviders(<PhaseStepper current="submission" />);

    expect(screen.getByTestId('phase-step-assessment')).toHaveAttribute('data-state', 'done');
    expect(screen.getByTestId('phase-step-requirement_chat')).toHaveAttribute('data-state', 'done');

    const current = screen.getByTestId('phase-step-submission');
    expect(current).toHaveAttribute('data-state', 'current');
    expect(current).toHaveAttribute('aria-current', 'step');

    expect(screen.getByTestId('phase-step-qa')).toHaveAttribute('data-state', 'upcoming');
    expect(screen.getByTestId('phase-step-report')).toHaveAttribute('data-state', 'upcoming');
    expect(screen.getByTestId('phase-step-qa')).not.toHaveAttribute('aria-current');
  });

  it('各ステップのラベルを MESSAGES から表示する', () => {
    renderWithProviders(<PhaseStepper current="assessment" />);
    for (const phase of attemptPhaseEnum.options) {
      expect(screen.getByTestId(`phase-step-${phase}`)).toHaveTextContent(
        MESSAGES.attempt.phaseLabels[phase],
      );
    }
  });
});
