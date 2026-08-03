import { useEffect, useRef, useState } from 'react';
import { POLL_MS_DEFAULT } from '../../shared/constants';
import type { Note } from '../../shared/schemas';
import { listNotes } from '../api/client';
import { envInterval } from '../utils/envInterval';

const POLL_MS = envInterval(
  import.meta.env.VITE_POLL_INTERVAL_MS as string | undefined,
  POLL_MS_DEFAULT,
);

export type PollingState =
  | { status: 'loading'; notes: Note[] }
  | { status: 'ready'; notes: Note[] }
  | { status: 'error'; notes: Note[]; message: string };

export function usePollingNotes(enabled = true) {
  const [state, setState] = useState<PollingState>({ status: 'loading', notes: [] });
  const aliveRef = useRef(true);
  const inflightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    aliveRef.current = true;
    inflightRef.current = false;
    setState({ status: 'loading', notes: [] });

    const tick = async () => {
      // Prevent overlapping fetches: when a previous tick is still in flight,
      // skip this one — two concurrent ticks would race on setState. Each poll
      // fetches the full, server-sorted list and replaces state wholesale
      // (summaries/deletes mutate old rows, so an append-only cursor can't
      // reflect them).
      if (inflightRef.current) return;
      inflightRef.current = true;
      try {
        const res = await listNotes();
        if (!aliveRef.current) return;
        setState({ status: 'ready', notes: res.notes });
      } catch (e) {
        if (!aliveRef.current) return;
        const msg = e instanceof Error ? e.message : 'unknown error';
        setState((prev) => ({ status: 'error', notes: prev.notes, message: msg }));
      } finally {
        inflightRef.current = false;
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);

    return () => {
      aliveRef.current = false;
      window.clearInterval(id);
    };
  }, [enabled]);

  return { state };
}
