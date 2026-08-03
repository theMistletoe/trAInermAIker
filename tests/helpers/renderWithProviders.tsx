import { type RenderOptions, render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { Toaster } from '../../src/client/components/ui/sonner';

interface ProvidersOptions {
  /** 初期 URL。指定がなければ "/" を使う。 */
  initialEntry?: string;
  /** ルートにマウントする要素を `path` ルートとしてラップしたい場合のパス（例: "/:id"）。 */
  routePath?: string;
}

/**
 * テストで「Router + Toaster」を毎回書くのを避けるヘルパー。
 * routePath を指定すれば `Route` でくるんで URL params を渡せる。
 *
 * Toast 通知は sonner に集約しており、ここで `<Toaster />` をマウントすることで
 * テスト中も `toast.success()` / `toast.error()` の呼び出しでDOM上にトーストが描画される。
 */
export function renderWithProviders(
  ui: ReactElement,
  { initialEntry = '/', routePath, ...options }: ProvidersOptions & RenderOptions = {},
) {
  const Wrapped = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>
      {routePath ? (
        <Routes>
          <Route path={routePath} element={children} />
        </Routes>
      ) : (
        children
      )}
      <Toaster />
    </MemoryRouter>
  );

  return render(ui, { wrapper: Wrapped, ...options });
}
