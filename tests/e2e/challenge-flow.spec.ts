import { Buffer } from 'node:buffer';
import { expect, type Page, test } from '@playwright/test';
import { buildCdkZipBytes } from '../fixtures/cdkZip';
import { AttemptPage } from './pages/attempt.page';
import { ChallengesPage } from './pages/challenges.page';
import { captureStep } from './support/evidence';

/**
 * 実 AI（OpenAI）を叩くフルジャーニー。assessment → requirement_chat →
 * submission → qa → report を 1 本の旅として通す。AI 依存のアサーションは
 * すべて presence/non-empty のみ（本文は絶対に検証しない）。
 */
test.setTimeout(900_000);

const CHALLENGE_TITLE = '小規模チーム向けファイル共有サービスを設計せよ';
const PASSWORD = 'e2e-Passw0rd!';
const SINGLE_CHOICE_QUESTION_IDS = [
  'cdk-experience',
  'aws-services',
  'iac-tools',
  'serverless-experience',
  'security-iam',
] as const;
async function signup(page: Page, email: string): Promise<void> {
  await page.goto('/signup');
  await page.getByTestId('signup-name').fill('E2E Flow User');
  await page.getByTestId('signup-email').fill(email);
  await page.getByTestId('signup-password').fill(PASSWORD);
  await page.getByTestId('signup-submit').click();
}

test('チャレンジ挑戦のフルジャーニー（実AI）', async ({ page }) => {
  const challenges = new ChallengesPage(page);
  const attempt = new AttemptPage(page);
  const email = `e2e-flow-${Date.now()}@example.com`;

  await test.step('サインアップしてトップに遷移する', async () => {
    await signup(page, email);
    await expect(page).toHaveURL('/', { timeout: 15_000 });
    await captureStep(page, '01-signup');
  });

  await test.step('チャレンジ一覧 → 詳細 → 挑戦開始で assessment に入る', async () => {
    await expect(challenges.cardByTitle(CHALLENGE_TITLE)).toBeVisible();
    await challenges.cardByTitle(CHALLENGE_TITLE).click();
    await expect(challenges.spec).toBeVisible();
    await challenges.startButton.click();
    await expect(page).toHaveURL(/\/attempts\/\d+$/, { timeout: 15_000 });
    await expect(attempt.workspace).toBeVisible();
    await expect(attempt.step('assessment')).toHaveAttribute('data-state', 'current');
    await captureStep(page, '02-attempt-started');
  });

  await test.step('アセスメント回答 → 提出 → requirement_chat へ進む', async () => {
    await expect(attempt.assessmentForm).toBeVisible();
    for (const questionId of SINGLE_CHOICE_QUESTION_IDS) {
      await attempt.choice(questionId, 'level-2').check();
    }
    await attempt.freeTextInput.fill(
      'CDKでのサーバーレス設計を学び、業務のインフラ構築に活かせるようになりたいです。',
    );
    await captureStep(page, '03-assessment-filled');
    await attempt.assessmentSubmit.click();
    // アセスメント評価は AI 呼び出し（スキルプロファイル生成）を含む。
    await expect(attempt.chatInput).toBeVisible({ timeout: 90_000 });
    await expect(attempt.step('requirement_chat')).toHaveAttribute('data-state', 'current');
    await captureStep(page, '03-requirement-chat');
  });

  await test.step('要件ヒアリングチャットで AI 応答を得る', async () => {
    await attempt.sendChat(
      'ファイルの種類と1ファイルの最大サイズ、想定ユーザー数を教えてください。',
    );
    // presence のみ検証: assistant 発言が現れ、空でないこと。本文は AI 依存なので見ない。
    await expect(attempt.assistantMessages.first()).toBeVisible({ timeout: 90_000 });
    await expect(attempt.assistantMessages.first()).toContainText(/\S/);
    await captureStep(page, '04-chat-reply');
  });

  await test.step('submission フェーズへ進む', async () => {
    await attempt.advanceButton.click();
    await expect(attempt.guide).toBeVisible({ timeout: 30_000 });
    await expect(attempt.fileInput).toBeVisible({ timeout: 30_000 });
    await expect(attempt.step('submission')).toHaveAttribute('data-state', 'current');
    await captureStep(page, '05-submission-phase');
  });

  await test.step('CDK zip をアップロードしてファイル一覧が出る', async () => {
    await attempt.fileInput.setInputFiles({
      name: 'cdk-solution.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(buildCdkZipBytes()),
    });
    await attempt.uploadButton.click();
    // fixture は 5 ファイル。4 件目が見えれば count >= 4。
    await expect(attempt.fileItems.nth(3)).toBeVisible({ timeout: 60_000 });
    await captureStep(page, '06-submission-uploaded');
  });

  await test.step('QA フェーズへ進み質問フォームが出る', async () => {
    // QA 質問生成は最も重い AI 呼び出し。
    await attempt.advanceButton.click();
    await expect(attempt.qaForm).toBeVisible({ timeout: 240_000 });
    await expect(attempt.qaAnswerInputs.first()).toBeVisible();
    await expect(attempt.step('qa')).toHaveAttribute('data-state', 'current');
    await captureStep(page, '07-qa-form');
  });

  await test.step('QA に全問回答してレポート生成まで到達する', async () => {
    // 質問数は AI 次第で動的。全入力欄に埋めて一括送信する。
    await attempt.submitQaForm(
      (i) =>
        `回答${i + 1}: まだ理解が浅いため、要点だけ述べると設計時に意識したのはコストと最小権限です。`,
    );
    await captureStep(page, '08-qa-submitted');

    // qa-completed → 自動 advance → report-generating → report-markdown の
    // どの割り込み地点でも、最終的にレポート本文が出ることを待つ。
    // 自動 advance が中断された場合（qa-completed のまま enabled な手動ボタンが
    // 残る）だけのフォールバック。auto-advance 進行中はボタンが disabled
    // （「進行中…」）なので触らない。best-effort: 失敗は握りつぶして本命の
    // report-markdown 待ちに任せる。
    const settled = attempt.reportMarkdown
      .or(attempt.reportGenerating)
      .or(attempt.qaCompleted)
      .first();
    await expect(settled).toBeVisible({ timeout: 120_000 });
    if (
      !(await attempt.reportMarkdown.isVisible().catch(() => false)) &&
      !(await attempt.reportGenerating.isVisible().catch(() => false)) &&
      (await attempt.advanceButton.isEnabled().catch(() => false))
    ) {
      await attempt.advanceButton.click({ timeout: 5_000 }).catch(() => {});
    }
    // レポート生成（重い AI 呼び出し）の完了を待つ。
    await expect(attempt.reportMarkdown).toBeVisible({ timeout: 300_000 });
    await expect(attempt.reportMarkdown).toContainText(/\S/);
    // Failed UI must not be mistaken for a ready report.
    await expect(page.getByTestId('report-generate-failed')).toHaveCount(0);
    // When the worker has a real key, timeout/errors must not persist the offline
    // stub copy. Stub-mode (no key / AI_STUB) still uses that copy by design.
    if (process.env.OPENAI_API_KEY) {
      await expect(attempt.reportMarkdown).not.toContainText('AI未接続');
    }
    await expect(attempt.step('report')).toHaveAttribute('data-state', 'current');
    await captureStep(page, '08-report-visible');
  });

  await test.step('レポート本文を選択して引用質問し AI 回答を得る', async () => {
    // useTextSelection は onMouseUp で window.getSelection() を読むため、
    // Range で選択を作ってから report-view に mouseup をバブルさせる。
    const selected = await page.evaluate(() => {
      const md = document.querySelector('[data-testid="report-markdown"]');
      const view = document.querySelector('[data-testid="report-view"]');
      if (!md || !view) return false;
      const walker = document.createTreeWalker(md, NodeFilter.SHOW_TEXT);
      let node: Text | null = null;
      while (walker.nextNode()) {
        const t = walker.currentNode as Text;
        if (t.textContent !== null && t.textContent.trim().length >= 10) {
          node = t;
          break;
        }
      }
      if (node === null || node.textContent === null) return false;
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, Math.min(node.textContent.length, 40));
      const sel = window.getSelection();
      if (!sel) return false;
      sel.removeAllRanges();
      sel.addRange(range);
      view.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      return true;
    });
    expect(selected).toBe(true);
    await expect(attempt.reportAskButton).toBeVisible();
    await attempt.reportAskButton.click();
    await expect(attempt.reportQuote).toBeVisible();
    await captureStep(page, '09-quote-chip');
    await attempt.sendChat('この点について、次に学ぶべきことを教えてください。');
    await expect(attempt.assistantMessages.first()).toBeVisible({ timeout: 120_000 });
    await expect(attempt.assistantMessages.first()).toContainText(/\S/);
    await captureStep(page, '09-report-chat-reply');
  });

  await test.step('リロードしても report フェーズが保持される', async () => {
    await page.reload();
    await expect(attempt.workspace).toBeVisible({ timeout: 30_000 });
    await expect(attempt.step('report')).toHaveAttribute('data-state', 'current');
    await expect(attempt.reportMarkdown).toBeVisible({ timeout: 30_000 });
    await captureStep(page, '10-reload-persistence');
  });
});
