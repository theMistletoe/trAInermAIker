import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 5173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

// エビデンスモード（CI でない・E2E_EVIDENCE=1）では動画/スクショ/トレースを常時収集する。
// 通常は失敗時のみ保持して結果の肥大化を避ける。
const evidence = process.env.E2E_EVIDENCE === '1';

export default defineConfig({
  testDir: './tests/e2e',
  // 各テストは一意な本文（Date.now() サフィックス）でノートを作るため、共有テーブル
  // 上でもアサーションは衝突しない。ローカルでは並列実行で速度を稼ぎ、CI は D1 local
  // の同時アクセス挙動が未検証なので安全側に倒して workers: 1 のままにしておく。
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  // CI 上での `.only` 取り残しを防ぐ
  forbidOnly: !!process.env.CI,
  // CI のフレーキー耐性（`trace`/`video` は retain-on-failure のままなので、
  // retry 導入後も artifact 増加は失敗時のみ）
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // 出力先（テスト中の動画・スクショ・トレース・添付ファイル）
  outputDir: 'test-results/e2e-artifacts',

  reporter: process.env.CI
    ? [
        ['list'],
        ['github'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['json', { outputFile: 'test-results/e2e-results.json' }],
      ]
    : [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['json', { outputFile: 'test-results/e2e-results.json' }],
      ],

  use: {
    baseURL: BASE_URL,
    // トレースは常に取得（失敗時にも、成功時にも遡れる方が便利）
    trace: evidence ? 'on' : 'retain-on-failure',
    // 動画は evidence モードでは常時、それ以外は失敗時のみ保持
    video: evidence ? 'on' : 'retain-on-failure',
    // スクショは失敗時のフルページ + 任意ステップで手動撮影（テスト側で撮る）
    screenshot: { mode: 'only-on-failure', fullPage: true },
    // ヘッドレス動作でも DOM の状態が分かるよう viewport を明示
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 事前インストール済みブラウザしか無い環境（リモートサンドボックス等）で、
        // Playwright が要求するリビジョンと一致しない場合の逃げ道。
        // 例: PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } }
          : {}),
      },
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        // ポーリング既定 500ms を E2E 向けに短縮し、反映待ちを速くする。
        env: { VITE_POLL_INTERVAL_MS: '100' },
      },
});
