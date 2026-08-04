# レビュー: feature コンポーネント 7 つ + テスト（ChatPanel / PhaseStepper / AssessmentForm / SubmissionUploader / CodeFileViewer / ReportView / ChallengeCard）

## レビュー対象
- 変更ファイル: `src/client/components/{ChatPanel,PhaseStepper,AssessmentForm,SubmissionUploader,CodeFileViewer,ReportView,ChallengeCard}.tsx` および対応する `tests/client/components/*.test.tsx`（計14ファイル、すべて未追跡の新規）
- 想定意図: feature コンポーネント7つを notes 実装の流儀（named export / MESSAGES 集約 / data-testid 契約 / disabled-while-submitting / sonner toast）で新規実装。pages/ と phase 統合は後続担当。

検証実施: 対象7テストファイルを実行し **28/28 green** を確認。Biome check も対象19ファイルでクリーンを確認。依存先（`useChatThread` / `useTextSelection` / `highlight.ts` / `CodeBlock` / `MarkdownView` / factories / renderWithProviders / shared schemas・constants・messages）も読んで突き合わせ済み。

## Critical（必ず修正）
なし。

## Warning（修正すべき）
- [x] **送信中に入力した追記が消える**: `ChatPanel.tsx:48-52` — `sending` 中も Textarea は入力可能（意図的で正しい）だが、`onSend` 解決時に無条件 `setDraft('')`。AI 応答は数秒〜15秒かかり得るため、待ち時間に次のメッセージを打ち始めたユーザーの下書きが解決時に無言で消える。NoteForm 同型パターンだが、あちらは ms オーダーの D1 insert で顕在化しない。 → `if (ok) setDraft((d) => (d === draft ? '' : d))` のように送信時点の値と一致する場合のみクリアする（クロージャで送信時 draft を捕捉）。 **→ 対応済み（送信時 draft を捕捉して一致時のみクリア + テスト追加）**
- [x] **ChatPanel の Textarea に maxLength がない**: `ChatPanel.tsx:116-122` — `NoteForm.tsx:35`（`NOTE_BODY_MAX`）、`AssessmentForm.tsx:55`（`ASSESSMENT_ANSWER_MAX`）は maxLength を付ける規約なのに ChatPanel だけ欠落。`schemas.ts:174` で送信は `CHAT_MESSAGE_MAX`(2000) 超をサーバー拒否するため、2000 字超の貼り付けは送信して初めて失敗する。 → `maxLength={CHAT_MESSAGE_MAX}` を追加。 **→ 対応済み**
- [ ] **`assessment-answer-input` の testid が質問ごとに一意でない**: `AssessmentForm.tsx:53` — 選択肢は `assessment-choice-${q.id}-${choice.id}` と一意なのに、free_text は固定文字列。schema（`schemas.ts:126-132`）は free_text 複数を許し、現行 `challenge1.ts` は free_text 1問だから今日は発火しないが、2問目が追加された瞬間に `getByTestId` と E2E ロケータが壊れる。testid は E2E 契約（`e2e.md`）なので後から変えにくい。 → 今のうちに `assessment-answer-input-${q.id}` に統一（テスト側も追随）。 **→ 見送り: 依頼仕様が `data-testid="assessment-answer-input"` 固定を明示しており、後続エージェント（pages/E2E 担当）がこの契約を前提にする。変更するなら仕様の持ち主（親）判断で。**
- [x] **成功送信後の quote チップの後始末が未定義**: `ChatPanel.tsx:48-52,95-114` — `onSend` は content のみ受け取り、quote の送信も成功後のクリアも親任せ。後続の pages 担当エージェントが「`thread.send(content, quote)` に渡す」「成功後 `onQuoteClear` 相当を呼ぶ」の両方を覚えていないと、引用付き質問後もチップが残留する。 → `if (ok)` 時に `onQuoteClear?.()` を呼ぶか、少なくとも props の JSDoc に親の責務を明記する。 **→ JSDoc で親の責務を明記（自動クリアは仕様外の挙動追加になるため親実装に委ねる）**
- [x] **仕様明記点のテスト欠落**: (a) quote の 120 字切り詰め、(b) `.zip` の大文字小文字無視、(c) `size === ZIP_MAX_BYTES` ちょうどが許可される境界。 **→ 3 ケースともテスト追加**

## Suggestion（検討推奨）
- [ ] `読み込み中…` リテラルがこの変更で `ChatPanel.tsx:58` / `CodeFileViewer.tsx:54` に増え、既存分（AppHeader / HomePage / MyNotesPage）と合わせ 5 箇所に散在 → `MESSAGES.common.loading` への集約を検討。`CodeFileViewer.tsx:60-61` の省略注記、`ChatPanel.tsx:107` の `aria-label="引用を解除"` も同様（テストが assert しない文言なので現規約違反ではない）。
- [ ] `CodeFileViewer.tsx:14-15` `formatSize` に MB 段がない — `ZIP_MAX_BYTES` は 10MB なので MB 級ファイルが `5120.0 KB` 表示になり得る。
- [ ] `ReportView.tsx:25` — 選択位置がコンテナ上端付近だと `selection.top` が負（`useTextSelection.ts:52` で `top - 36` に clamp なし）。ページ側の overflow 次第でボタンが見切れる可能性（ページ未実装のため未確認）。
- [ ] `AssessmentForm` は `getAssessmentResponseSchema` が返す既存 `answers` を初期値として受け取れない。再訪画面が不要なら現状で良いが、pages 担当が必要とする可能性があるので interface 判断を共有しておくとよい。

## 意図とのズレ
- 満たしている要件: 7コンポーネント全て named export・MESSAGES 集約・kebab-case data-testid・disabled-while-submitting。ChatPanel: onSend true のみクリア（解決前保持もテスト済み）・Enter 送信なし・quote 120 字切り詰め実装。AssessmentForm: 全問回答ガード＋空白は未回答＋質問順 answers。SubmissionUploader: クリック時に拡張子（小文字化）と ZIP_MAX_BYTES 検証＋ `toast.error`。CodeFileViewer: `extToLanguage`＋`CodeBlock`＋isTruncated 注記。ReportView: `useTextSelection`＋フローティング「AIに質問」（mousedown preventDefault で選択解除前にクリック成立、実装は正しい）。ChallengeCard: react-router `Link`。pages/phases には未着手（指示どおり）。
- 不足/ズレている要件: Warning 5 点目のテスト欠落（→ 対応済み）。
- やりすぎている部分: なし。scrollIntoView の自動追従は仕様外だがチャット UI の最小限として妥当。
- 未確認事項: 指定スコープ外のファイル変更は未レビュー。

## 総合判断
**APPROVE**（Warning 対応を推奨） — 仕様要点は実装レベルで全て満たし、28 テスト green・Biome クリーンを実測確認。既存 notes の流儀への追従も丁寧。
