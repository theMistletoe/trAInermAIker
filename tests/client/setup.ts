import '@testing-library/jest-dom/vitest';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { mswServer } from '../mocks/server';

// jsdom には window.matchMedia がないため、sonner の system テーマ検出用にポリフィルする。
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// --- multipart (File アップロード) を jsdom で成立させる ---
// jsdom の Blob/File/FormData は Node の fetch (undici) と混在すると
// multipart の filename/中身が落ちる。undici が理解する実装へ揃える。
// FormData だけ差し替えると window.FormData が jsdom のまま残り得るため、
// Blob/File も含めて globalThis と window の両方を更新する。
const nativeFormDataClass = (
  await new Response('a=b', {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  }).formData()
).constructor as typeof FormData;

const installWebApi = (target: typeof globalThis | Window) => {
  Object.defineProperty(target, 'Blob', {
    writable: true,
    configurable: true,
    value: NodeBlob,
  });
  Object.defineProperty(target, 'File', {
    writable: true,
    configurable: true,
    value: NodeFile,
  });
  Object.defineProperty(target, 'FormData', {
    writable: true,
    configurable: true,
    value: nativeFormDataClass,
  });
};

installWebApi(globalThis);
if (typeof window !== 'undefined') {
  installWebApi(window);
}

// MSW: any un-mocked HTTP request fails the test ("error" mode) so that
// drift between code and handlers is detected loudly instead of silently
// hitting the network.
beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

afterEach(() => {
  cleanup();
});
