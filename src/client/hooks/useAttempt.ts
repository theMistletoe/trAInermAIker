import { useCallback, useEffect, useState } from 'react';
import type { Attempt } from '../../shared/schemas';
import { getAttempt } from '../api/client';

export type AttemptState =
  | { status: 'loading' }
  | { status: 'ready'; attempt: Attempt }
  | { status: 'error'; error: unknown };

// Fetches one attempt on mount and re-fetches when `refresh` is called.
// Errors are surfaced as-is in state: pages inspect ApiError (e.g. 401 → login
// redirect) themselves — navigation never lives in hooks.
export function useAttempt(attemptId: number): {
  state: AttemptState;
  refresh: () => void;
  applyAttempt: (attempt: Attempt) => void;
} {
  const [state, setState] = useState<AttemptState>({ status: 'loading' });
  const [fetchCount, setFetchCount] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchCount is the manual refresh trigger
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    getAttempt(attemptId)
      .then((res) => {
        if (alive) setState({ status: 'ready', attempt: res.attempt });
      })
      .catch((error: unknown) => {
        if (alive) setState({ status: 'error', error });
      });
    return () => {
      alive = false;
    };
  }, [attemptId, fetchCount]);

  const refresh = useCallback(() => {
    setFetchCount((n) => n + 1);
  }, []);

  // Mutations (advance, submitAssessment, …) return the updated attempt; adopt
  // it directly instead of paying an extra round-trip.
  const applyAttempt = useCallback((attempt: Attempt) => {
    setState({ status: 'ready', attempt });
  }, []);

  return { state, refresh, applyAttempt };
}
