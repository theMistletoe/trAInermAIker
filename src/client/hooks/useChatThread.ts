import { useCallback, useEffect, useRef, useState } from 'react';

export interface ChatItem {
  // `msg-${id}` for server rows, `optimistic-${n}` for pending entries.
  key: string;
  role: 'user' | 'assistant';
  content: string;
  quotedText: string | null;
  pending: boolean;
}

// Module-level monotonic counter: deterministic optimistic keys without
// touching Date, and unique across every thread instance in the page.
let optimisticSeq = 0;

// Generic optimistic chat thread over any load/send pair (requirement chat and
// report Q&A share the exact same UX). `send` resolves to the server rows that
// REPLACE the optimistic user entry in place (typically [user, assistant]).
export function useChatThread(deps: {
  load: () => Promise<ChatItem[]>;
  send: (content: string, quotedText: string | null) => Promise<ChatItem[]>;
}): {
  messages: ChatItem[];
  loading: boolean;
  loadFailed: boolean;
  sending: boolean;
  send: (content: string, quotedText?: string | null) => Promise<boolean>;
  reload: () => void;
} {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadCount, setLoadCount] = useState(0);

  const aliveRef = useRef(true);
  // Guards concurrent sends synchronously (state updates are async).
  const sendingRef = useRef(false);
  // Callers typically inline the deps object, so its identity changes every
  // render; route calls through a ref so effects/callbacks stay stable.
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadCount is the manual reload trigger
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadFailed(false);
    depsRef.current
      .load()
      .then((items) => {
        if (!alive) return;
        setMessages(items);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setLoadFailed(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadCount]);

  const send = useCallback(
    async (content: string, quotedText: string | null = null): Promise<boolean> => {
      if (sendingRef.current) return false;
      sendingRef.current = true;
      setSending(true);
      optimisticSeq += 1;
      const key = `optimistic-${optimisticSeq}`;
      const optimistic: ChatItem = { key, role: 'user', content, quotedText, pending: true };
      setMessages((prev) => [...prev, optimistic]);
      try {
        const resolved = await depsRef.current.send(content, quotedText);
        if (aliveRef.current) {
          setMessages((prev) => prev.flatMap((m) => (m.key === key ? resolved : [m])));
        }
        return true;
      } catch {
        // Caller keeps the draft and shows a toast; just roll the thread back.
        if (aliveRef.current) {
          setMessages((prev) => prev.filter((m) => m.key !== key));
        }
        return false;
      } finally {
        sendingRef.current = false;
        if (aliveRef.current) setSending(false);
      }
    },
    [],
  );

  const reload = useCallback(() => {
    setLoadCount((n) => n + 1);
  }, []);

  return { messages, loading, loadFailed, sending, send, reload };
}
