# レビュー: フェーズ UI・ページ・ルーティング・notes クライアント削除

- 日時: 2026-08-04
- スコープ: フェーズコンポーネント 5、ページ 3、ページテスト 3、App/AppHeader/api client/index.html/Login・Signup・NotFound、mocks、notes クライアント UI・E2E 削除一式
- レビュアー: parallel-reviewer (agentId: ae8c2f96ad93d8c0b)

---

レビュー完了です。指定スコープの全ファイルを読み、周辺依存（`useAttempt` / `useChatThread` / `ChatPanel` / `CodeFileViewer` / `PhaseStepper` / `SubmissionUploader` / mocks / `renderWithProviders` / `messages.ts`）と突き合わせました。加えて `npx vitest run tests/client/pages/` (12/12 green) と `npx playwright test --list` を実測しています。

## レビュー対象
- 変更ファイル: フェーズコンポーネント 5（`src/client/components/phases/*.tsx`）、ページ 3（`ChallengeListPage` / `ChallengeDetailPage` / `AttemptWorkspacePage`）、ページテスト 3（`tests/client/pages/*.test.tsx`）、および `App.tsx` / `AppHeader.tsx` / `api/client.ts` / `index.html` / `Login・Signup・NotFoundPage` / `tests/mocks/*` / `tests/client/setup.ts` / notes クライアント UI・E2E の削除一式
- 想定意図: 課題挑戦フロー UI の完成（5 フェーズ + 3 ページ + ルーティング/ブランディング切替 + notes クライアント UI 削除）。MyNotesPage の one-shot fetch + alive flag + 401→/login パターン踏襲、MESSAGES 集約、MSW ベースの新テスト追加

## Critical（必ず修正）

- [ ] **E2E テストが 0 件になり CI が確実に落ちる**: notes E2E（`note-flow.spec.ts` / `auth-flow.spec.ts`）削除後、`tests/e2e/` に残るのは `pages/toast.component.ts` と `support/evidence.ts` のみで spec が 1 つもない。実測で `npx playwright test --list` → `Error: No tests found`, **exit 1**。`.github/workflows/ci.yml:92` は PR ごとに `npm run test:e2e:evidence` を実行するため、この状態で PR を出すと必ず赤になる（Stop hook の verify は E2E を回さないため検知されていない）。 → このマイルストーン内で最低限のスモーク spec（課題一覧表示 → 詳細遷移程度）を追加するか、E2E 追加を同一変更に含める。
- [ ] **再提出後に古いファイル内容を表示する（stale キャッシュ）**: `src/client/components/phases/SubmissionPhase.tsx:77-89` の `handleUpload` 成功時に `fileCache` / `selectedPath` をリセットしないため、`:93` の `if (fileCache.has(path)) return;` が旧 submission の内容を返し続ける。再現: v1 の zip を提出 → `src/index.ts` を閲覧 → 修正した v2 を再提出（アップローダーは常時表示なので主要フロー）→ 同じ `src/index.ts` をクリック → **v1 の内容が表示される**。また新 submission に存在しないパスが `selectedPath` に残ると、一覧のどれも選択されていないのに旧内容がペインに残留する。 → `handleUpload` 成功時に `setFileCache(new Map()); setSelectedPath(null);` を追加。

## Warning（修正すべき）

- [ ] **「特に見てほしい点」として挙げられた 4 つのロジックが、いずれもテスト未カバー**: 実装自体は下記の通り正しいことをコードで確認したが、テストが挙動を保証していない。
  - NaN ガード（`AttemptWorkspacePage.tsx:17-21`）: `/attempts/abc` → NotFound のケースが `tests/client/pages/AttemptWorkspacePage.test.tsx` にない
  - QaPhase 自動 advance（`QaPhase.tsx:87-91`）: どのテストも `done: false`（デフォルトハンドラ）のみで、`done: true` → 自動 `advanceAttempt` → report 遷移、および advance 失敗 → 手動ボタン表示のフォールバックが未検証
  - `SUBMISSION_NOT_FOUND` → null（`SubmissionPhase.tsx:64-71`）: デフォルトハンドラが常に提出済みを返すため「未提出」分岐（`submission-files-empty` 表示 + advance disabled）が一度も実行されない
  - ReportPhase の引用付き送信と成功時のみの quote クリア（`ReportPhase.tsx:57-65`）: ページ/フェーズレベルのテストなし
  → `tests/client/pages/` へのケース追加（`mswServer.use` で `done: true` / `SUBMISSION_NOT_FOUND` / advance 500 を注入）を推奨。リスクの高い箇所ほどハッピーパスしかないのが現状。
- [ ] **ヘッダーとページの幅制約が不整合**: `App.tsx` は main の `max-w-2xl` をページ側へ移したが、`AppHeader.tsx:46` の内側コンテナは `max-w-2xl` のまま。一覧/詳細は `max-w-3xl`、ワークスペースは `max-w-5xl` なので、広いページではブランドリンク・メニューがコンテンツ左右端と揃わない。意図的な中央寄せなら現状維持で良いが、判断の明文化が必要 → ヘッダーを `max-w-5xl` 等に広げるか、意図をコメントで残す。

## Suggestion（検討推奨）

- [ ] `読み込み中…` リテラルが本変更で 5 箇所増、既存分と合わせ 8 箇所 → `MESSAGES.common.loading` へ集約。
- [ ] `getChallenge` の二重フェッチ: submission フェーズではタイトル用とガイド用で同一課題を 2 回 GET する → 親で取得して props で渡せば 1 回で済む。
- [ ] 引用付き質問の楽観表示に `【引用】` プレフィックスがない: サーバー応答で置換された瞬間にプレフィックス付きへ変わる（表示がチラつく）。
- [ ] `SubmissionPhase` の submission 一覧取得失敗表示が個別ファイル用の `MESSAGES.submission.fileLoadFailed` を流用 → 専用文言が正確。
- [ ] `handleSelect` の並行競合: ファイル A ロード中に B をクリックすると A の `finally` が `fileLoading` を false に戻し、B 到着まで空ペインになる。実害は一瞬の表示のみ。
- [ ] 401 → `/login` 後の戻り先が `/` 固定: `location.state` での return-to は後続判断で可。

## 意図とのズレ

- 満たしている要件: 5 フェーズコンポーネントと 3 ページの新設 / ルーティング差し替えとブランド切替 / notes クライアント UI・フック・API 関数・テスト・E2E の削除 / one-shot fetch + alive flag + `ApiError` 401→`/login` パターンの正確な踏襲 / MESSAGES 集約 / `tests/client/pages/` の MSW テスト追加（12/12 green 実測、`vi.mock` 不使用・schema `.parse()` 経由でルール準拠）/ サーバー側 notes コードと `VITE_POLL_INTERVAL_MS` の温存
- 不足/ズレている要件: notes E2E「削除」の裏で **E2E スイートが空になり CI 前提が壊れた**（Critical 1 参照）。それ以外はなし
- やりすぎている部分: なし

補足: QaPhase の自動 advance は `autoAdvancedRef` + `advancingRef` の二重ガードで StrictMode の二重 effect 下でも単発発火になることを確認。失敗時の手動フォールバック、`SUBMISSION_NOT_FOUND` の null 化、quote の成功時のみクリア、NaN ガードはいずれも実装として正しい。問題は Critical 2 の stale キャッシュと、これらのテスト欠落のみ。

## 総合判断

**REQUEST_CHANGES** — E2E 0 件による確実な CI 破壊（実測 exit 1）と、再提出後に旧ファイル内容を表示する stale キャッシュの 2 点は必ず修正が必要。この 2 点を除けば、状態設計・パターン踏襲・テストの作法とも品質は高い。

---

## 対応記録（実装エージェント）

- Critical 2（stale キャッシュ）: 同セッションで修正。`handleUpload` 成功時に `fileCache` を空にし `selectedPath` を null へリセット。
- Critical 1（E2E 0 件）: 今回のマイルストーン指示が「新しい challenge E2E は後続マイルストーンで追加（keep toast.component.ts + support/evidence.ts）」と明示しているため、本セッションでは spec を追加せず、CI リスクとして依頼元へ明示的に報告する（意図とのズレ照合が必要な項目として扱う）。
- Warning（テスト未カバー）: 低リスクの範囲で `qa done:true → 自動 advance → report 表示` と `SUBMISSION_NOT_FOUND → 未提出表示 + advance disabled` の 2 ケースを追加。残り（NaN ガード・ReportPhase 引用送信）は依頼元へ報告。
- Warning(ヘッダー幅): 指示が AppHeader の変更をブランド文言とメニューに限定していたため現状維持とし、依頼元へ報告。
- Suggestion: ルールに従い今回は見送り。
