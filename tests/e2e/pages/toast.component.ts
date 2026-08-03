import type { Locator, Page } from '@playwright/test';

/**
 * Sonner トーストの Component Object。
 *
 * トーストは URL 単位の画面ではなくグローバル UI のため、ページではなく
 * コンポーネントとして切り出す。複数表示されるケースもあるが、
 * 検証対象は基本的に「直近の1件」なので `first` だけを公開する。
 */
export class ToastComponent {
  readonly first: Locator;

  constructor(page: Page) {
    this.first = page.locator('[data-sonner-toast]').first();
  }
}
