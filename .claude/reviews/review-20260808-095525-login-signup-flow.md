# レビュー: ログイン/サインアップ間の導線追加

- 日時: 2026-08-08 09:55
- ブランチ: `claude/login-signup-flow-fqk255`
- レビュアー: parallel-reviewer サブエージェント

---

## レビュー対象
- 変更ファイル: `src/shared/messages.ts`, `src/client/pages/LoginPage.tsx`, `src/client/pages/SignupPage.tsx`, `tests/e2e/challenge-guards.spec.ts`, `.claude/rules/e2e.md`, 未追跡: `tests/client/pages/LoginPage.test.tsx`, `tests/client/pages/SignupPage.test.tsx`
- 想定意図: サインアップ未済のユーザーがログイン画面で迷子にならないよう、ログイン画面に区切り線+案内文+サインアップ導線を追加し、対称としてサインアップ画面にログインへ戻る導線を追加する。

## Critical（必ず修正）
- なし

## Warning（修正すべき）
- [x] **区切り線の色がデザイントークン(`--border`)ではなく `currentColor`(≒ほぼ黒/ほぼ白)で描画される**: `LoginPage.tsx:68` と `SignupPage.tsx:79` の divider は `after:border-t` のみで色指定がない。Tailwind v4 preflight は `*, ::after, ::before { border: 0 solid; }`(= 色は `currentColor`)を設定し(`node_modules/tailwindcss/preflight.css:7-15` で確認)、`index.css:177-180` の `* { @apply border-border }` は**擬似要素にマッチしない**(CSS 仕様上 `*` は要素のみ)。結果、`::after` の線は継承色 `text-card-foreground`(light: `oklch(0.205 …)` のほぼ黒 / dark: ほぼ白)になり、アプリ内の他のすべての境界線(`--border` = 薄いグレー)と明確に不一致になる。shadcn 公式の login ブロックはこの同一パターンに `after:border-border` を明記しており、コピー時にこの 1 クラスが欠落した形。→ 両ファイルの divider `<div>` に `after:border-border` を追加(2 箇所、各 1 クラス)。なお本プロジェクトは `--card: oklch(1 0 0 / 92%)` と半透明のため、ラベル `<span>` の `bg-card` 越しに線が約 8% 透けるが、線色を `--border` に直せば実用上不可視であり追加対応は不要。
  - **対応済み**: 両ファイルの divider に `after:border-border` を追加し、実ブラウザのスクリーンショットで薄いグレーの線になることを確認。

## Suggestion（検討推奨）
- [ ] **divider 構造の重複**: `after:absolute after:inset-0 after:top-1/2 …` の複合クラス+`bg-card` ラベルの構造が `LoginPage.tsx:68-72` と `SignupPage.tsx:79-83` で完全に重複している。2 箇所なので現状維持でも許容範囲だが、3 箇所目が出たら `SeparatorWithLabel` 的な小コンポーネントへの抽出を推奨(上記 Warning の修正漏れが片側だけ起きた事実自体が重複の弊害)。
  - 対応: 規約(原則スルー)に従い今回は見送り。3 箇所目が出た時点で抽出する。

## 意図とのズレ
- 満たしている要件:
  - ログイン画面の区切り線+案内文+サインアップボタン導線(`LoginPage.tsx:68-81`、`login-to-signup`)
  - サインアップ画面からログインへ戻る対称導線(`SignupPage.tsx:84-92`、`signup-to-login`)
  - 文言の `MESSAGES.auth` への集約(`messages.ts:13-20`)— 「UI 文言は messages.ts」規約に適合、テストも同一定数を参照
  - `data-testid` 契約の更新(`e2e.md` の nav/auth 行)と E2E 往復テスト(`challenge-guards.spec.ts:22-35`、AI 不要・デフォルトタイムアウトで同ファイルの「安価なガード系」方針に適合)
  - クライアントテスト 2 ファイル: 既存パターン(`renderWithProviders`+相対 import)に準拠、MSW ハンドラ不要な操作のみで `onUnhandledRequest: 'error'` と無競合(実行して 4 件 pass を確認)
- 不足/ズレている要件: なし
- やりすぎている部分: `CardHeader` への `CardDescription` 追加(`loginDescription`/`signupDescription`)は依頼の厳密な範囲外。ただし「画面の目的を明示して迷子を防ぐ」という意図には沿う軽微な追加であり、削除要求はしない(ユーザーへの確認事項として認識)
  - 対応: ユーザーへの報告に明記し、不要なら削除できる旨を伝える。

## 総合判断
**REQUEST_CHANGES** — 機能・テスト・規約適合はすべて良好(a11y も lucide の自動 `aria-hidden`、`Button asChild`+`Link` の Slot 合成、focus-visible リングまで問題なし)だが、本依頼の核心である「視覚的な導線設計」の最も目立つ新規要素(区切り線)が light/dark 両モードでデザイントークンから外れて描画される。修正は 2 ファイル各 1 クラス追加で完了する。
→ **Warning 対応済みのため解消**。

## 補足(レビュアーの未確認事項)
- Playwright E2E の実走は dev サーバー起動を要するためレビュアー側では未実施(セレクタ・遷移は静的確認+jsdom テストで同等経路を検証済み)。※親セッション側で実走済み(1 passed)。
- divider 色は preflight CSS と CSS 仕様からの確定的推論(修正後に親セッション側で実ブラウザ確認済み)。
