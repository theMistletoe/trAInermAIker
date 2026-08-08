# レビュー: レポートのAI質問チャットのスティッキー化

- 対象ブランチ: `claude/ai-question-ui-sticky-17cxh0`(base: main f7dd943)
- 変更ファイル: `src/client/components/ChatPanel.tsx`, `src/client/components/phases/ReportPhase.tsx`
- 意図: レポートフェーズで本文をスクロールしてもAI質問チャットが常に見える(sticky化)+ 返信到着時に閲覧位置が飛ばないようにする

## Critical(必ず修正)

- なし

## Warning(修正すべき)

- なし(機能的な欠陥・契約破壊は検出できませんでした)

## Suggestion(検討推奨)

- [x] マジックナンバー `4.5rem` / `6rem` のヘッダー高への暗黙結合: `ReportPhase.tsx` の `lg:top-[4.5rem]`(=72px)と `lg:max-h-[calc(100vh-6rem)]` は `AppHeader.tsx` の `sticky top-0` + `h-14`(56px+border)に依存した値だが、導出根拠のコメントがない。同種の結合がある `ChallengeListPage.tsx:33` は「sticky ヘッダー(h-14)へ潜り込むのを防ぐ」とWHYコメントを残す規約precedentになっている → 同様の1行コメント追加を推奨 **(→ 対応済み)**
- [ ] 低い viewport でカード内スクロールが入力欄を隠す: カード内容(タイトル+リスト最大 `max-h-96`=384px+引用チップ+textarea最大160px)が `100vh-6rem` を超える環境(例: 高さ約700px以下のlg画面)では `lg:overflow-y-auto` によりカード自体がスクロールし、入力欄が折り返しの下に落ちる。「常に質問できる」を厳密に保証するなら、リスト側を可変(`flex-1 min-h-0`)にして入力欄をカード下端に固定する構造が本筋(ChatPanel の固定 `max-h-96` を親から制御可能にする改修が必要)。現状の max-h+overflow は「stickyで入力欄が画面外に固定される」最悪ケースを防ぐ正しいガードなので、現実装のままでも許容範囲 **(→ 現実装のまま。フォローアップ候補)**

## 意図とのズレ

- 満たしている要件:
  - lg以上(E2E viewport 1280x800 含む)でチャットカードが `sticky top-[4.5rem]` により常時表示。ヘッダー(57px)と重ならず、grid の `self-start` 維持により sticky が正しく機能する(祖先 `App.tsx` → `AttemptWorkspacePage.tsx:69` に overflow/transform なし、body スクロール前提が成立)
  - 返信到着・履歴初回ロード時の画面ジャンプ解消: `scrollIntoView`(全スクロール祖先を巻き込む)→ リストコンテナのみの `scrollTop = scrollHeight` へ。**PR #5 の「html の `scroll-behavior: smooth` に巻き込まれない」意図も保持** — `scroll-behavior` は非継承プロパティで、`scrollTop` 代入は当該要素の computed 値(`auto`=instant)に従うため
  - `max-h-40` で `field-sizing-content` の無制限成長を抑止し、sticky カードの高さ暴走を防止(`min-h-16` と共存、twMerge で両方保持。超過分は textarea 既定の overflow でスクロール)
- 不足/ズレている要件:
  - **lg 未満(<1024px)では sticky が効かず従来どおり**(全クラスが `lg:` プレフィックス)。単一カラムではカードがレポート下にあるため sticky top では解決不能で、モバイル対応にはフローティングUI等の別設計が必要 **(→ 承認済みプランで対象外と明記。フォローアップ候補)**
- やりすぎている部分:
  - `max-h-40` は共有コンポーネントのため requirement_chat フェーズの入力欄にも波及。ただし無制限成長の抑止は両フェーズで妥当な改善であり、退行・契約破壊はなし。同様に window 自動スクロール廃止も requirement_chat に波及するが、そちらはリスト直上に入力欄がある構造のため実害なし(むしろ挙動が予測可能になる)

## 総合判断

**APPROVE** — 意図(sticky化+閲覧位置保護)を最小差分で達成。検証済み: data-testid 契約(`chat-input`/`chat-send`/`chat-message`/`chat-pending`/`chat-empty`/`report-quote`/`report-quote-clear`)は全て単一のまま存置で E2E ロケータ(attempt.page.ts)は非破壊、削除された sentinel div に testid なし。`report-ask-button`(z-10)と sticky カード(z-index auto)の重なりは変更前と同一の描画順で退行なし、`useTextSelection` は mouseup 時の live な getBoundingClientRect 差分計算のため sticky の影響なし。jsdom では `scrollTop` setter/`scrollHeight` getter とも実装済みで旧 `scrollIntoView` の optional call 相当の防御は不要。実測: biome check クリーン、tsc(client/client.test)クリーン、client テスト 23件 全パス。
