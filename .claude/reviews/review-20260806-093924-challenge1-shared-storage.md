## レビュー対象
- 変更ファイル: `src/server/content/challenge1.ts`, `src/server/lib/stubs.ts`, `tests/unit/content.test.ts`
- 想定意図: 課題1を「個人フォルダ相当」から「社内共有ストレージ＋最小限の権限境界（共有閲覧/登録、社外禁止、削除は本人or管理者）」へ更新し、認証・IAM学習強度と運用/コスト意識を両立させる

## Critical（必ず修正）
- [x] **提出ガイド設問3が削除権限要件を誤記している**: 「管理者だけが削除」→「登録者本人または管理者のみが削除」に修正済み

## Warning（修正すべき）
- [x] **境界テストが薄い**: description の共有文脈・個人フォルダ否定、および提出ガイド/rubric/hiddenSpec の削除権限一致 assertion を追加済み
- [ ] **ネガティブ assertion**: 上記で一部強化済み

## Suggestion（検討推奨）
- [ ] stub QA 1問に要件が詰め込みすぎ
- [ ] `docs/firstPRD.md` が旧仕様のまま（スコープ外）
- [ ] `tests/client/setup.ts` は別件差分

## 総合判断
**REQUEST_CHANGES** → Critical 対応済み。世界観更新は妥当。
