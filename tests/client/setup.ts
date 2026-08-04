import '@testing-library/jest-dom/vitest';
import { ReadableStream as NodeReadableStream } from 'node:stream/web';
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

// --- multipart (File アップロード) を jsdom で成立させる 2 点セット ---
// (1) jsdom の Blob は stream() を実装していない。fetch 側 (undici) は
// stream() の有無で File 判定するため、欠けていると jsdom File は filename も
// 中身も失う。読み手が undici なので Node の ReadableStream を返す。
if (typeof Blob.prototype.stream !== 'function') {
  Blob.prototype.stream = function stream(this: Blob) {
    const blob = this;
    return new NodeReadableStream({
      async start(controller) {
        controller.enqueue(new Uint8Array(await blob.arrayBuffer()));
        controller.close();
      },
    }) as unknown as ReturnType<typeof Blob.prototype.stream>;
  };
}

// (2) jsdom の FormData は fetch (undici) の Request がシリアライズできない
// (multipart 化の際に filename/中身が壊れる)。fetch スタック自身が属する
// FormData クラスを Response#formData() 経由で取り出して差し替えることで、
// 「Request が理解できる FormData」であることを実装コピーに依らず保証する。
const nativeFormDataClass = (
  await new Response('a=b', {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  }).formData()
).constructor as typeof FormData;
Object.defineProperty(globalThis, 'FormData', {
  writable: true,
  configurable: true,
  value: nativeFormDataClass,
});

// MSW: any un-mocked HTTP request fails the test ("error" mode) so that
// drift between code and handlers is detected loudly instead of silently
// hitting the network.
beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

afterEach(() => {
  cleanup();
});
