---
paths:
  - "src/**"
  - "migrations/**"
---

# 並行コードレビュー（parallel-reviewer の起動）

実装作業の節目で `.claude/agents/parallel-reviewer.md` のサブエージェントを **Agent (Task) tool で起動** し、批判的レビューを受ける。可能なら背景実行し、その間も次の作業を進める。完了通知後、または次ターン頭で指摘に対応する。

## 起動タイミング（いずれか到達したら原則トリガー）

- 関数・モジュール・コンポーネントを 1 つ書き終えた
- ユーザー依頼の機能を一通り実装し終えた
- `git commit` を行う直前
- PR / merge request を作成する直前

## 起動しない（ノイズ防止）

- タイポ・コメント・README のみの変更
- 自動生成物（lockfile、`*.tsbuildinfo`、`worker-configuration.d.ts` 等）のみの変更
- 直前の起動から差分が 5 行未満かつ意味的に同範囲（重複起動防止）
- ユーザーが `skip review` 等で明示的に止めた直後のターン

## 起動方法

`subagent_type: parallel-reviewer` で Agent を起動し、prompt に必ず含める:

- レビュー対象スコープ（未追跡ファイルがある場合は **ファイルパスを列挙**。`git diff HEAD` だけでは untracked が漏れる）
- 親エージェントが受けた**ユーザー意図の要約 1–3 行**（意図とのズレ判定に必須）
- 「`.claude/agents/parallel-reviewer.md` に厳密に従い、Critical / Warning / Suggestion / 意図とのズレ / 総合判断の構造で日本語の Markdown を返す」旨

## 結果の取り扱い

完了通知（または次ターン頭の subagent 出力）を受けたら:

1. レビュー全文を `.claude/reviews/review-<yyyymmdd-HHMMSS>-<short-desc>.md` に保存（無ければディレクトリ作成）。履歴として残す価値があるため tracked のままにする。
2. **Critical**: 必ず同セッション内で修正する。
3. **Warning**: 低リスク・自明なら修正、判断要なら 1–2 行でユーザーに確認。
4. **Suggestion**: 原則スルー、明示要望時のみ対応。
5. **意図とのズレ**: ユーザーへ必ず照合確認する（勝手に解釈を変えない）。
6. `REQUEST_CHANGES` 総合判断は無視せず、最低でも理由を 1 行でユーザーに共有してから先に進む。

## やってはいけない

- 1 ターンで複数回 parallel-reviewer を起動する（連続節目でもまとめて 1 回）
- レビュー結果のうち都合の良い指摘だけ採用する（Critical をスキップしない）
