# レビュー: Hono routes 層（challenges / attempts）

- 日時: 2026-08-03 23:06
- レビュアー: parallel-reviewer（agentId: af841029530b17e4e）
- 対象: `src/server/routes/challenges.ts`（新規）、`src/server/routes/attempts.ts`（新規）、`src/server/index.ts`（ルートチェーン追加）

---

## レビュー対象
- 変更ファイル:
  - `/Users/motoakitanaka/workspace/products/trAInermAIker/src/server/routes/challenges.ts`（新規）
  - `/Users/motoakitanaka/workspace/products/trAInermAIker/src/server/routes/attempts.ts`（新規）
  - `/Users/motoakitanaka/workspace/products/trAInermAIker/src/server/index.ts`（ルートチェーン追加）
- 想定意図: notes.ts のパターンを厳密に踏襲した Hono routes 層の実装（チェーン式・zValidator フック・`responseSchema.parse` 終端・mapXError 集約・attempts 全点 401 判定・`/mine` 先行登録）。index.ts は AppType capture 前のチェーン追加のみ。

検証実施: `tsc -p tsconfig.server.json` クリーン、`biome check`(対象3ファイル)クリーンを自分で再実行して確認。エラー写像 14 項目は全サービスの throw 箇所と突き合わせ済み。malformed body の挙動は最小再現スクリプトで実証済み(後述)。vitest の再実行は未実施(親報告の 143/22 passed は未検証だが、テスト一覧に routes テストが存在しないことは確認済み)。

## Critical（必ず修正）
- なし。

## Warning（修正すべき）
- [ ] **構文レベルで壊れたリクエストボディが 400 ではなく 500 INTERNAL_ERROR になる**: Hono の `zValidator` は malformed JSON / malformed multipart に対し `HTTPException(400)` を **throw** し(`node_modules/hono/dist/validator/validator.js` の json/form ケース)、`src/server/index.ts:39-42` の `onError` が `HTTPException` を区別せず一律 500 に変換する。再現スクリプトで実証: `Content-Type: application/json` + `{bad json` → `500 {"error":"INTERNAL_ERROR"}`、壊れた multipart → 同じく 500。notes.ts にも存在する**既存挙動**だが、本変更でボディを受ける 7 エンドポイント + multipart アップロードが加わり表面積が大きく拡大した。「zValidator フックで INVALID_BODY 400」という契約は zod 検証失敗にしか効かず、パース失敗には効いていない → 推奨修正: `onError` 冒頭に `if (err instanceof HTTPException) return c.json(errorBody('INVALID_BODY'), 400);`(または `err.getResponse()` 尊重)。ただし index.ts は「チェーン追加のみ」のスコープ指定のため、本件は別コミットの扱いで親/ユーザー判断を仰ぐこと。
- [ ] **POST /:id/submission は認証・サイズ検査の前にボディ全体をメモリへバッファする**: `attempts.ts:275-277` の `zValidator('form', ...)` は内部で `c.req.arrayBuffer()` → `bufferToFormData` を実行し全バイトをメモリ化する。`getSessionUser` の 401 判定(`attempts.ts:279-280`)も `ZIP_MAX_BYTES`(10MB)チェック(`submissionService.ts:64-65`、コメント "Reject before buffering" はルート層では既に成立していない)もその後。未認証クライアントが Cloudflare のボディ上限(無料 100MB)までのアップロードで isolate メモリ(128MB)を圧迫できる → 推奨修正: form validator の前に軽量ミドルウェアを挿入し、`Content-Length` が `ZIP_MAX_BYTES + マージン` 超なら `errorBody('ZIP_TOO_LARGE'), 413` を即返す(あわせて認証チェックも前置可能。ミドルウェアのレスポンス型は hc 推論に影響しない)。
- [ ] **新規ルートのテストがゼロ**: `tests/integration/` は `notes.api.test.ts` / `ownership.api.test.ts` のみで、`grep -rln "/api/attempts\|/api/challenges" tests/` はヒットなし。親報告の「integration 22 passed」は notes スライスのみの結果であり、本変更のエンドポイント(401 判定・エラー写像・/mine 順序・201/200 分岐)は一切保証されていない → 推奨修正: スライス順(route → tests)の次工程としてテスト追加を同マイルストーン内で行うことを明示。

## Suggestion（検討推奨）
- [ ] `attemptIdParamSchema` の zValidator が 13 回、`getSessionUser` + 401 判定が 16 回コピペされている(`attempts.ts:135-137` ほか)。`const attemptIdParam = zValidator('param', attemptIdParamSchema, hook)` をモジュール先頭に 1 つ定義して再利用してもチェーン型推論は壊れない。notes パターン(インライン)厳守の指示との天秤だが、16 連はスケールが違う。
- [ ] `challenges.ts:23-26` の GET `/` のみ try/catch なし(同ファイル GET `/:id` にはある)。同期・インメモリなので実害は薄く notes の `/mine`(notes.ts:66-71)と同型だが、`parse` 失敗時は onError 500 へ落ちる点は把握しておくこと。
- [ ] `attempts.ts:285` の再アップロード置換時も常に 201。置換は意味論上 200 も検討余地あり(service が `created` 相当を返さないため現状は一律 201 で妥当だが、記録として)。

## 意図とのズレ
- 満たしている要件:
  - チェーン式ルーター・`c.json(responseSchema.parse(value), status)` 終端(全 18 ハンドラ確認)
  - `mapChallengeError` / `mapAttemptError` への写像集約。**期待対応表 14 項目(AttemptNotFoundError→404 … ReportNotFoundError→404)が `attempts.ts:68-96` と完全一致**、かつ全サービスの throw 箇所と過不足なし(`ChatLimitExceededError` の reportService 経由再利用も同一クラスなので instanceof 成立を確認)
  - attempts 全 16 ハンドラで `getSessionUser` → 401(漏れなし)
  - `/mine` を `/:id` より先に登録(`attempts.ts:119-120`)
  - server 相対 import、`INVALID_BODY`/`INVALID_ID` フック、schemas.ts の全エンドポイントを網羅(余計なルートなし)
  - index.ts は AppType capture 前のチェーン追加 + import 2 行のみ。notFound/onError/auth mount の位置不変
- 不足/ズレている要件: routes 層のテスト未着手(上記 Warning。スライス順では次工程だが、依頼文で明示されていないため要確認)。「INVALID_BODY 400」契約が構文的 malformed body に対して破れている(既存挙動の継承)。
- やりすぎている部分: なし。なお他ユーザーの attempt を 403 でなく 404(ATTEMPT_NOT_FOUND)で隠す設計は `server-errors.md` の「403 はサービスが投げる」原則からの逸脱に見えるが、`schemas.ts:312-313` の enum コメントで契約側に明文化されており意図的設計と判断。

## 総合判断
**APPROVE** — routes 層としてはパターン忠実・エラー写像完全一致・認証漏れなしで実装品質は高い。Warning 3 件はいずれも既存パターン由来(onError の HTTPException 握り潰し)またはスコープ外遡及(テスト・サイズ前置チェック)であり本変更のブロッカーではないが、malformed body → 500 と submission のバッファリング順は次のマイルストーンで必ず対処すること。
