import { expect, test } from '@playwright/test';
import { HomePage } from './pages/home.page';
import { attachContextVideos, captureStep, newEvidenceContext } from './support/evidence';

test('匿名でノートを投稿し、要約が別コンテキストにもポーリングで伝播する', async ({
  page,
  browser,
}) => {
  const home = new HomePage(page);
  // notes テーブルは全テスト・全実行で共有されるため、本文は必ず一意化する。
  const body = `E2Eノート ${Date.now()}`;

  await test.step('A: ホームを開く', async () => {
    await home.goto();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await captureStep(page, '01-home');
  });

  await test.step('A: 一意な本文でノートを投稿する', async () => {
    await home.postNote(body);
    await expect(home.noteByBody(body)).toBeVisible();
    await captureStep(page, '02-posted');
  });

  const ctxB = await newEvidenceContext(browser);
  try {
    const pageB = await ctxB.newPage();
    const homeB = new HomePage(pageB);

    await test.step('B: 別コンテキストにポーリングで伝播する', async () => {
      await homeB.goto();
      await expect(homeB.noteByBody(body)).toBeVisible();
      await captureStep(pageB, '03-b-sees-note');
    });

    await test.step('A: 要約を生成する（非空のみ検証）', async () => {
      await home.summarizeButtonFor(body).click();
      const summary = home.noteByBody(body).getByTestId('note-summary');
      // 実 Workers AI（Secrets あり）とスタブ（なし）の両方で通るよう、
      // 内容は検証せず「表示されて非空」だけを確認する。実 AI は遅いことがある。
      await expect(summary).toBeVisible({ timeout: 20_000 });
      await expect(summary).not.toBeEmpty();
      await captureStep(page, '04-summarized');
    });

    await test.step('B: 要約もポーリングで伝播する', async () => {
      const summaryB = homeB.noteByBody(body).getByTestId('note-summary');
      await expect(summaryB).toBeVisible({ timeout: 10_000 });
      await expect(summaryB).not.toBeEmpty();
      await captureStep(pageB, '05-b-sees-summary');
    });

    await attachContextVideos(ctxB, 'context-b');
  } finally {
    await ctxB.close();
  }
});

test('空白のみの入力では投稿ボタンが disabled のまま', async ({ page }) => {
  const home = new HomePage(page);

  await test.step('空白のみを入力する', async () => {
    await home.goto();
    await home.noteInput.fill('   ');
    await expect(home.noteSubmit).toBeDisabled();
    await captureStep(page, '01-whitespace-disabled');
  });
});
