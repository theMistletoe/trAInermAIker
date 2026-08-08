import { useCallback, useEffect, useState } from 'react';

export type HistoryDataState<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: T };

/**
 * 履歴セクション共通の「マウント時に1回読み込み + 手動再試行」フェッチ。
 * セクションの中身はアコーディオンを開いた時に初めてマウントされるため、
 * これがそのまま lazy fetch になる。loader は再レンダーで再実行されないよう
 * モジュールレベルの安定した関数を渡すこと。
 */
export function useHistoryData<T>(load: (attemptId: number) => Promise<T>, attemptId: number) {
  const [state, setState] = useState<HistoryDataState<T>>({ status: 'loading' });
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    // epoch は retry で再実行させるためだけの依存。
    void epoch;
    let alive = true;
    setState({ status: 'loading' });
    load(attemptId)
      .then((data) => {
        if (alive) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (alive) setState({ status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [load, attemptId, epoch]);

  const retry = useCallback(() => setEpoch((n) => n + 1), []);

  return { state, retry };
}
