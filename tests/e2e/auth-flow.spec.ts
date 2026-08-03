import { expect, test } from '@playwright/test';
import { AuthPage } from './pages/auth.page';
import { HomePage } from './pages/home.page';
import { captureStep } from './support/evidence';

test('サインアップ→投稿→自分のノート→削除→ログアウトの所有権フロー', async ({ page }) => {
  const auth = new AuthPage(page);
  const home = new HomePage(page);
  // 再実行しても衝突しないよう、email と本文は一意化する。
  const email = `e2e-${Date.now()}@example.com`;
  const body = `所有ノート ${Date.now()}`;

  await test.step('一意な email でサインアップして /mine へ遷移する', async () => {
    await auth.gotoSignup();
    await auth.signup(email, 'password-1234', 'E2Eユーザー');
    await captureStep(page, '01-signed-up');
  });

  await test.step('ノートを投稿するとオーナーとして削除ボタンが見える', async () => {
    await home.goto();
    await home.postNote(body);
    await expect(home.noteByBody(body)).toBeVisible();
    await expect(home.deleteButtonFor(body)).toBeVisible();
    await captureStep(page, '02-owned-note');
  });

  await test.step('/mine に自分のノートが表示される', async () => {
    await page.goto('/mine');
    await expect(auth.myNoteItems.filter({ hasText: body })).toBeVisible();
    await captureStep(page, '03-my-notes');
  });

  await test.step('削除するとポーリング反映で一覧から消える', async () => {
    await home.goto();
    await home.deleteButtonFor(body).click();
    await expect(home.noteByBody(body)).toBeHidden();
    await captureStep(page, '04-deleted');
  });

  await test.step('ログアウトするとメニューにログインが戻る', async () => {
    await auth.logout();
    await auth.openMenu();
    await expect(auth.navLogin).toBeVisible();
    await captureStep(page, '05-logged-out');
  });
});

test('匿名で投稿したノートには削除ボタンが描画されない', async ({ page }) => {
  const home = new HomePage(page);
  const body = `匿名ノート ${Date.now()}`;

  await test.step('匿名で投稿する', async () => {
    await home.goto();
    await home.postNote(body);
    await expect(home.noteByBody(body)).toBeVisible();
    await captureStep(page, '01-anonymous-posted');
  });

  await test.step('削除ボタンが存在しない', async () => {
    await expect(home.deleteButtonFor(body)).toHaveCount(0);
    await captureStep(page, '02-no-delete-button');
  });
});
