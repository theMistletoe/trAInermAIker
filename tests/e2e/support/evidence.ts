import { type Browser, type BrowserContext, type Page, test } from '@playwright/test';

/**
 * 任意ステップのフルページスクショを撮影し、HTML レポートにも添付する。
 * `test-results/e2e-artifacts` 配下にも残るのでエビデンスとして参照しやすい。
 *
 * `E2E_EVIDENCE=1` のときだけ撮影する（`recordVideo` と同じガード方針）。
 * CI のデフォルト実行では `screenshot: 'only-on-failure'` に任せて
 * artifact サイズの肥大化を避ける。
 */
export async function captureStep(page: Page, name: string): Promise<void> {
  if (process.env.E2E_EVIDENCE !== '1') return;
  const buffer = await page.screenshot({ fullPage: true });
  await test.info().attach(`step-${name}`, {
    body: buffer,
    contentType: 'image/png',
  });
}

/**
 * `browser.newContext()` は playwright.config の `use.video` を継承しないため、
 * `E2E_EVIDENCE=1` のときに動画も取得できるよう明示的に recordVideo を渡す。
 * 終了後は `attachContextVideos` で HTML レポートに添付する。
 */
export async function newEvidenceContext(browser: Browser): Promise<BrowserContext> {
  const evidence = process.env.E2E_EVIDENCE === '1';
  return browser.newContext(
    evidence
      ? { recordVideo: { dir: test.info().outputDir, size: { width: 1280, height: 800 } } }
      : {},
  );
}

/**
 * コンテキスト配下の各 page で記録された動画を HTML レポートに添付する。
 * ベストエフォート: 添付に失敗しても他の証跡（trace/screenshot）が残るので throw しない。
 */
export async function attachContextVideos(ctx: BrowserContext, label: string): Promise<void> {
  if (process.env.E2E_EVIDENCE !== '1') return;
  for (const [index, page] of ctx.pages().entries()) {
    const video = page.video();
    if (!video) continue;
    try {
      await page.close();
      const path = await video.path();
      await test.info().attach(`video-${label}-${index + 1}`, { path, contentType: 'video/webm' });
    } catch {
      // ベストエフォート。失敗しても他の証跡は残る。
    }
  }
}
