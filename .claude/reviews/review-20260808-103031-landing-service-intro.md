# Review: トップページ初見向けサービス紹介の追加

- 日時: 2026-08-08 10:30
- 対象ブランチ: `claude/improve-landing-page-description-ivwcoo`
- レビュアー: parallel-reviewer(サブエージェント)
- 対応状況: Critical 0 / Warning 2件とも同セッションで修正済み / Suggestion 1件採用・1件見送り(下記)

## レビュー対象
- 変更ファイル: `src/client/components/ServiceIntro.tsx`(新規)、`tests/client/components/ServiceIntro.test.tsx`(新規)、`src/shared/messages.ts`、`src/client/pages/ChallengeListPage.tsx`、`index.html`、`src/client/index.css`、`tests/client/pages/ChallengeListPage.test.tsx`、`tests/e2e/pages/challenges.page.ts`、`tests/e2e/challenge-guards.spec.ts`、`.claude/rules/e2e.md`
- 想定意図: トップページに初見向けのサービス紹介(ヒーロー+5フェーズ図解+特徴3カード)をグラフィカルに追加し、「何のサービスか」をひと目で伝える

## Critical(必ず修正)
- なし

## Warning(修正すべき)
- [x] **グローバル smooth scroll がアテンプト画面のチャット自動スクロールにも波及する**: `src/client/index.css` の `html { scroll-behavior: smooth }` は「トップのアンカーCTA用」とコメントされているが、実際にはドキュメント全体に効く。`src/client/components/ChatPanel.tsx` の `bottomRef.current?.scrollIntoView?.({ block: 'end' })` は `behavior` 未指定のため CSS の計算値に従い、チャット末尾が画面外にあるときに発生するドキュメントレベルのスクロールがメッセージ追加・送信のたびにアニメーション化される(要件ヒアリング/レポート問答ページ)。従来は即時ジャンプだった挙動の変更で、意図したスコープ(ランディング)の外。→ **対応: ChatPanel 側を `scrollIntoView?.({ block: 'end', behavior: 'instant' })` に変更して従来挙動を固定**
- [x] **E2E のクリック後アサーションが常に真(トートロジー)**: `tests/e2e/challenge-guards.spec.ts` — Playwright の `toBeVisible()` はビューポート内判定を含まないため、カードは CTA クリック前から visible であり、アンカー遷移が壊れてもこのテストは落ちない。→ **対応: クリック後に `await expect(page).toHaveURL(/#challenges$/)` を追加し、視覚的到達は `toBeInViewport()` で検証するよう変更**

## Suggestion(検討推奨)
- [ ] **ログイン済みユーザーにも「アカウントを作る」CTA が出る**: `/` はログイン/サインアップ後の遷移先でもあるため、既存ユーザーがヒーローの signup CTA を見続ける。`useSession` で出し分ける場合、`tests/mocks/handlers.ts` に get-session ハンドラ(null 返却)が既にあるので jsdom テストは壊れない。製品判断なので現状のままでも可 → **見送り(v1 の割り切りとして PR 本文に明記)**
- [x] **meta description と `MESSAGES.landing.heroLead` の文言が手動同期**: `index.html` は静的で TS を import できないため重複自体は妥当だが、同期を示すコメントを残すと将来のコピー改訂時の乖離を防げる → **対応: `index.html` に同期コメントを追加**

## 意図とのズレ
- 満たしている要件: サービスの一言説明(バッジ「実践課題 × AIとの問答で学ぶ」+見出し+リード文で「要件を自ら引き出す→自分でつくって提出→問答とレポートで確かめる」を完全にカバー)/5フェーズの図解(`attemptPhaseEnum.options` を順序の単一ソースに、ラベルは `MESSAGES.attempt.phaseLabels` を再利用してワークスペースのステッパーと表記一致)/グラフィカル要素(装飾ブロブ・グラデーション見出し・chart トークンの色分けタイル+アイコン — `--chart-1..5` は light/dark/システム dark の3ブロックすべてで定義済み、グラデーション両端も両テーマで背景と十分なコントラスト)/初見導線(課題一覧アンカー+サインアップの2CTA、meta description/title で検索・共有流入の初見にも対応)
- 不足/ズレている要件: なし
- やりすぎている部分: smooth scroll のグローバル適用のみ(Warning 1 で対応)。`index.html` の title/meta 追加と max-w-5xl 化・h1→h2 降格は意図実現に必要な範囲内

## 総合判断
**APPROVE**(Warning 2件はいずれも1〜2行の低リスク修正なので同セッション内対応を推奨 → 対応済み)。実装は既存規約に忠実 — 文言は `MESSAGES` に集約、POM はロケータのみ、`landing-*` testid 契約を `e2e.md` に明記、単一 h1 の見出し階層、装飾要素は `aria-hidden` + `pointer-events-none`、reduced-motion ガードあり。lucide アイコン11個の実在(v1.27.0)、`getByRole('heading', {name})` のレベル非依存性、h1 セレクタへの外部依存なしも実地確認した。テスト・型・lint 全通過を独立に再検証済み。
