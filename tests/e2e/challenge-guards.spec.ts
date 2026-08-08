import { expect, type Page, test } from '@playwright/test';
import { MESSAGES } from '../../src/shared/messages';
import { ChallengesPage } from './pages/challenges.page';

/**
 * AI を呼ばない安価なガード系テスト。デフォルトタイムアウトで動く。
 * 認証リダイレクト・公開ページの表示・認証ジャーニーを検証する。
 */

const CHALLENGE_ID = 'aws-cdk-file-sharing';
const CHALLENGE_TITLE = '小規模チーム向けファイル共有サービスを設計せよ';
const PASSWORD = 'e2e-Passw0rd!';

async function signup(page: Page, email: string): Promise<void> {
  await page.goto('/signup');
  await page.getByTestId('signup-name').fill('E2E Guards User');
  await page.getByTestId('signup-email').fill(email);
  await page.getByTestId('signup-password').fill(PASSWORD);
  await page.getByTestId('signup-submit').click();
}

test('ログイン画面の案内からサインアップ画面へ遷移できる（往復）', async ({ page }) => {
  await page.goto('/login');

  // 未登録ユーザー向けの案内文と導線が見えている
  await expect(page.getByText(MESSAGES.auth.noAccountLead)).toBeVisible();
  await page.getByTestId('login-to-signup').click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByTestId('signup-submit')).toBeVisible();

  // 逆方向: サインアップ画面からログイン画面へ戻れる
  await page.getByTestId('signup-to-login').click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId('login-submit')).toBeVisible();
});

test('未ログインで挑戦開始するとログインページへリダイレクトされる', async ({ page }) => {
  const challenges = new ChallengesPage(page);
  await challenges.gotoDetail(CHALLENGE_ID);
  await expect(challenges.startButton).toBeVisible();
  await challenges.startButton.click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
});

test('未ログインで attempt ページを開くとログインページへリダイレクトされる', async ({ page }) => {
  await page.goto('/attempts/999999');
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
});

test('チャレンジ一覧と詳細は未ログインでも閲覧できる', async ({ page }) => {
  const challenges = new ChallengesPage(page);
  await challenges.gotoList();
  await expect(challenges.cardByTitle(CHALLENGE_TITLE)).toBeVisible();
  await challenges.cardByTitle(CHALLENGE_TITLE).click();
  await expect(page).toHaveURL(new RegExp(`/challenges/${CHALLENGE_ID}$`));
  await expect(challenges.spec).toBeVisible();
  // タイトルはページ h1 と spec 内 markdown h1 の両方に現れるため、spec 側に絞る。
  await expect(challenges.spec.getByRole('heading', { name: CHALLENGE_TITLE })).toBeVisible();
});

test('サインアップ → ログアウト → 再ログインでトップに戻る', async ({ page }) => {
  const email = `e2e-guards-${Date.now()}@example.com`;

  await signup(page, email);
  await expect(page).toHaveURL('/', { timeout: 15_000 });

  // ログアウト
  await page.getByTestId('nav-menu').click();
  await page.getByTestId('nav-logout').click();
  // handleLogout は signOut 完了後に非同期でメニューを閉じるため、閉じ切ってから
  // 開き直す（先に開くと後からの setOpen(false) に巻き込まれて閉じられる）。
  await expect(page.getByTestId('nav-menu-panel')).toBeHidden({ timeout: 10_000 });
  // メニューを開き直すと未ログイン向けリンクに切り替わっている
  await page.getByTestId('nav-menu').click();
  await expect(page.getByTestId('nav-login')).toBeVisible({ timeout: 10_000 });

  // 再ログイン
  await page.getByTestId('nav-login').click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(PASSWORD);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL('/', { timeout: 15_000 });

  // ログイン済み: メニューにログアウトが出る
  await page.getByTestId('nav-menu').click();
  await expect(page.getByTestId('nav-logout')).toBeVisible({ timeout: 10_000 });
});
