# レビュー: M1(基盤)+M2(コンテンツ+AI seam+zip) — 56504ee..ba514c0

総合判断: **REQUEST_CHANGES**(対応状況は末尾)

## レビュー対象
- 変更ファイル: `wrangler.jsonc`, `src/server/types.ts`, `tests/env.d.ts`, `vitest.workers.config.ts`, `.dev.vars.example`, `package.json`, `src/shared/schemas.ts`, `src/shared/constants.ts`, `src/shared/messages.ts`, `src/server/content/{types,challenge1,index}.ts`, `src/server/lib/{ai,agent,prompts,stubs,zip}.ts`, `tests/unit/{content,openaiClient,agent,zipExtract,challengeSchemas}.test.ts`
- 想定意図: PRD (docs/firstPRD.md) の AI 学習課題アプリを notes 参照実装の流儀(共有 Zod 契約・AI スタブ fallback)で実装する基盤フェーズ。AI は OpenAI GPT-5.6(REST のみ、キー未設定/AI_STUB=1 で決定的スタブ)。

## Critical(必ず修正)
- [x] **wrangler.jsonc のコメントが存在しない deploy.yml の挙動を主張しており、push 時の本番デプロイが失敗する**: `wrangler.jsonc:22-24` のコメントは「Production bucket is created idempotently by deploy.yml (`r2 bucket info || create`)」と書くが、`.github/workflows/deploy.yml` に R2 関連ステップは一切ない。バケット未作成のまま main に push すると `wrangler deploy` がバインディング解決で失敗する。

## Warning(修正すべき)
- [x] **guardVerbatimLeak の検出保証は「81字以上」ではなく「約120字以上」**: 窓 81 字・ステップ 40 のサンプリングでは、返信の中間にある逐語コピーは最悪 120 字未満で素通りする。窓 41 字・ステップ 40(保証 = 80 字)へ調整するか、コメント/テスト名を実態に合わせる。
- [x] **personaBrief(SECRET)は逐語リークガードの対象外**: `guardVerbatimLeak` が `hiddenSpecMd` のみ照合。personaBrief 抽出への最終防衛線がない。
- [x] **秘匿仕様に §9 技術的制約・§10 提出物要件まで含まれており、ユーザーが知る正当な経路がない**: 非技術者ペルソナがチャットで自然に開示できない提出フォーマット情報を秘匿すると「知り得ない要件で減点される」構造になる。§9/§10 を公開側(提出フェーズの提出要領)へ移すべき。

## Suggestion(検討推奨)
- [ ] `zip.ts` の `maxTotalChars` はソフト上限(境界をまたぐ最後のファイルは超過し得る)。意図的なら 1 行コメントを。
- [x] `messages.ts` の「10MB以下」文言が `ZIP_MAX_BYTES` と二重管理。
- [ ] テストの import スタイル混在(エイリアス vs 相対)。
- [ ] `ai.ts` は `finish_reason === 'length'`(トークン上限による尻切れ)を検出しない。
- [x] `requirementChatReply` の `history` は「現在の userMessage を含まない」暗黙契約 — JSDoc で明文化を。

## 意図とのズレ
- 満たしている要件: 5フェーズ状態機械契約 / スキルプロファイル保存・参照 / 要件を渡さないペルソナ(プロンプト+逐語ガード二層) / R2 バインディング / 動的問題数(3-10、PRD 11.b の4観点一致) / レポート見出し構造・引用付き質問 / GPT-5.6 REST + 決定的スタブ / AI_STUB 優先順位 / 秘匿情報の構造的防御(Zod projection) / zip 安全ガード(fflate central directory 確認済み)。
- 不足/ズレ: §9/§10 の秘匿化(Warning 3件目)。
- やりすぎ: フロント用6依存が未使用のまま追加(M4 で使用予定の先行導入)。

## 総合判断
REQUEST_CHANGES — コード本体の品質・テストは高水準だが、wrangler.jsonc コメントの虚偽(Critical)と、逐語ガード保証・秘匿範囲の方針確定が M3 ルート実装前に必要。

---

## 対応状況(オーケストレーター追記)
- Critical: deploy.yml に idempotent な R2 バケット作成ステップを追加して解消(コメントを事実化)。
- Warning 1: 窓 41 字・ステップ 40(保証 ≥80 字)に変更、コメント・テスト更新。
- Warning 2: ガード対象を hiddenSpecMd + personaBrief の結合に拡張。
- Warning 3: `submissionGuideMd`(§9+§10)を公開フィールドとして新設し、challengeDetail で配信・提出フェーズ UI で表示(M4)。QA/レポートプロンプトには提出要領として引き続き供給。
- Suggestion: messages の 10MB 文言を ZIP_MAX_BYTES から導出に変更、history の JSDoc 追記。他は見送り。
