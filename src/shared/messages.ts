/**
 * UI 文言の集約。
 * i18n を入れない代わりに、プロダクトコードとテストの文言をここで一元管理し、
 * 二重リテラルのタイポ事故を防ぐ。
 */
export const MESSAGES = {
  note: {
    postFailed: 'ノートの投稿に失敗しました',
    summarize: '要約する',
    summarizing: '要約中…',
    summarizeFailed: '要約に失敗しました',
    summaryLabel: '要約',
    delete: '削除',
    deleteFailed: '削除に失敗しました',
    deleted: 'ノートを削除しました',
    empty: 'まだノートがありません',
  },
  auth: {
    signupFailed: 'サインアップに失敗しました',
    loginFailed: 'メールアドレスまたはパスワードが正しくありません',
    logoutFailed: 'ログアウトに失敗しました',
    myNotesFailed: 'ノートの取得に失敗しました',
  },
} as const;
