# 最終レビュー: feat/trainermaiker 全体 (56504ee..bea4752) — PR作成直前

総合判断: **APPROVE**(Critical 0 / Warning 3 / Suggestion 6)

## レビュー対象
- 全146ファイル(+12,159 / −2,220)。重点: M3サーバー層(migrations 0004-0007、db/services/routes、index.ts)、M5削除の取り残し、M6(E2E・CI/deploy・docs)、秘匿4フィールドのwire経路通し追跡、PRD最終突合。
- 検証: 秘匿フィールドは content → challengeService明示プロジェクション → 全ハンドラの `responseSchema.parse` 終端(Zodが未知キーをstrip) → 回帰テスト(raw textで否定アサート)の全経路でwire到達不能を確認。attempts全16ハンドラの401ガード・所有権スコープも漏れなし。

## Critical(必ず修正)
- なし。

## Warning(修正すべき)
- [x] **assessment提出の途中失敗でattemptが恒久ブリック**: answers INSERT成功後にCAS失敗→再送がUNIQUE衝突で永遠に500。→ `insertAssessmentAnswers` をupsert化(`ON CONFLICT ... DO UPDATE`)で解消。
- [x] **zip正規化パス衝突で500+不整合なsubmission行**: `lib\a.ts` と `lib/a.ts` が同一パスに正規化されUNIQUE衝突。→ `extractTextFiles` で先勝ちdedupe(衝突分はskippedCount)+unit test追加。
- [x] **アップロードのContent-Lengthゲートはchunkedで素通り・認証前に全ボディバッファ**: → form validator前に認証ミドルウェアを前置。chunked時の権威チェックはサービス側 `file.size` に残ることをコメント明記。

## Suggestion(検討推奨)
- [→ユーザー確認] Worker名・D1名がテンプレート名のまま(`cloudflare-templete`)。本番URLに露出。改名するなら初回デプロイ前が最後のチャンス。
- [x] wrangler.jsonc の「Placeholder id」コメントが実態(本番ID設定済み)と逆 → 修正。README/CLAUDE.mdの「deploy.ymlが同じ検証を再実行」も不正確(E2EはPR CIのみ) → 修正。
- [x] playwright.config.ts のnotes時代のコメント → 修正。
- [x] CI e2e jobのtimeout 35分はretries込み最悪ケースに不足 → 50分へ。
- [ ] 並行系の軽微な非対称(qa並行回答の敗者が409 QA_COMPLETED / self-heal並行GETの二重生成)— リトライで回復するため記録のみ。
- [ ] 再アップロード置換順(新put失敗時に旧提出が消える)— zip原本は再読不要のため実害小、記録のみ。

## 意図とのズレ
- PRD全項目充足(問答4観点のenum/プロンプト/DB CHECK 1:1、動的問題数3-10、レポート引用質問、GPT-5.6 REST、シンタックスハイライト、R2保存)。notes完全削除。E2E実AI+キー無し環境スタブ縮退の両立。不足・やりすぎなし。
- Worker/D1命名のみユーザー確認事項。

## 総合判断
APPROVE — 秘匿情報のwire非到達・認証/所有権スコープ・エラー写像・PRD突合のすべてで穴なし。CAS+self-healの並行性設計とテスト網羅は水準が高い。

---

## 対応状況(オーケストレーター追記)
Warning 3件・Suggestion 4件を同セッションで修正済み([x]印)。Worker命名はユーザーへ確認。
