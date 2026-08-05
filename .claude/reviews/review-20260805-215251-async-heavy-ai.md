## レビュー対象
- 変更ファイル: `migrations/0008_generation_jobs.sql`, `wrangler.jsonc`, `src/server/workflows/heavyAi.ts`, `generationService.ts`, `regenerateService.ts`, `attemptService.ts`, `qaService.ts`, `reportService.ts`, `db/attempts|qa|reports`, `lib/agent|ai`, `routes/attempts`, `schemas/messages`, `QaPhase/ReportPhase`, `client.ts`, 関連 tests / docs
- 想定意図: Q&A・レポート生成を Workflow 非同期化し、live AI 失敗時は stub を成功として書かず `failed`+再生成、stub/キーなしは即時決定的 stub、退行をテストで検知

## Critical（必ず修正）
- [x] live QA が空/不足レスポンスを stub で埋めて成功永続化する → `valid.length < QA_QUESTIONS_MIN` で throw に変更。単体テスト更新。
- [x] sticky `pending` → generating UI に retry、stale pending (15m) で force re-enqueue、`tryClaimGenerationPending` で二重 enqueue 抑制。

## Warning（修正すべき）
- [x] ready stub の regenerate 導線 → レポート画面に「レポートを再生成」ボタン。
- [x] regenerate API の integration テスト追加。
- [x] self-heal 二重 enqueue → CAS claim。

## Suggestion
- `GENERATION_FAILED` は将来用に schema に残置（失敗は 200 + status failed）。
- ポーリング上限は stale re-enqueue + retry UI で代替。

## 総合判断
**REQUEST_CHANGES** を受け Critical を同セッションで修正済み。
