import { MESSAGES } from '@shared/messages';
import { type AttemptPhase, attemptPhaseEnum } from '@shared/schemas';
import { Badge } from '@/components/ui/badge';

interface PhaseStepperProps {
  current: AttemptPhase;
}

// enum の宣言順がそのままフェーズの進行順。
const PHASES = attemptPhaseEnum.options;

const BADGE_VARIANT = {
  done: 'secondary',
  current: 'default',
  upcoming: 'outline',
} as const;

export function PhaseStepper({ current }: PhaseStepperProps) {
  const currentIndex = PHASES.indexOf(current);
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {PHASES.map((phase, index) => {
        const state =
          index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming';
        return (
          <li key={phase} className="flex items-center gap-2">
            {index > 0 && (
              <span aria-hidden="true" className="text-muted-foreground">
                ›
              </span>
            )}
            <Badge
              variant={BADGE_VARIANT[state]}
              data-testid={`phase-step-${phase}`}
              data-state={state}
              {...(state === 'current' ? { 'aria-current': 'step' as const } : {})}
            >
              {MESSAGES.attempt.phaseLabels[phase]}
            </Badge>
          </li>
        );
      })}
    </ol>
  );
}
