import { ZIP_MAX_BYTES } from './constants';

/**
 * UI 文言の集約。
 * i18n を入れない代わりに、プロダクトコードとテストの文言をここで一元管理し、
 * 二重リテラルのタイポ事故を防ぐ。
 */
export const MESSAGES = {
  auth: {
    signupFailed: 'サインアップに失敗しました',
    loginFailed: 'メールアドレスまたはパスワードが正しくありません',
    logoutFailed: 'ログアウトに失敗しました',
    otpSent: '認証コードをメールで送信しました',
    otpFailed: '認証コードが正しくないか、有効期限が切れています',
    otpResendFailed: '認証コードの再送信に失敗しました',
  },
  challenge: {
    listTitle: '課題一覧',
    listFailed: '課題一覧の取得に失敗しました',
    empty: '課題がまだありません',
    detailFailed: '課題の取得に失敗しました',
    start: '課題を開始する',
    starting: '開始中…',
    startFailed: '課題の開始に失敗しました',
  },
  attempt: {
    loadFailed: '進行状況の取得に失敗しました',
    advance: '次のフェーズに進む',
    advancing: '進行中…',
    advanceFailed: 'フェーズの移行に失敗しました',
    phaseLabels: {
      assessment: 'スキル確認',
      requirement_chat: '要件ヒアリング',
      submission: '成果物提出',
      qa: '問答',
      report: 'レポート',
    },
  },
  assessment: {
    title: 'スキル確認',
    lead: 'この課題で得られる学びに関わる、現在の理解度を教えてください。回答は後のフェーズでAIが参照します。',
    loadFailed: '質問の取得に失敗しました',
    submit: '回答を送信する',
    submitting: '送信中…',
    submitFailed: '回答の送信に失敗しました',
  },
  chat: {
    placeholder: 'メッセージを入力…',
    send: '送信',
    sendFailed: 'メッセージの送信に失敗しました',
    thinking: 'AIが応答を作成中…',
    empty: 'まだメッセージがありません。課題提出者に質問して要件を引き出しましょう。',
    loadFailed: 'メッセージの取得に失敗しました',
  },
  submission: {
    title: '成果物の提出',
    lead: 'AWS CDKのコード一式をzip形式でまとめて提出してください。',
    upload: '提出する',
    uploading: 'アップロード中…',
    uploaded: '提出が完了しました',
    uploadFailed: 'アップロードに失敗しました',
    tooLarge: `ファイルサイズは${ZIP_MAX_BYTES / 1024 / 1024}MB以下にしてください`,
    invalidType: 'ZIP形式のファイルを選択してください',
    filesTitle: '提出ファイル',
    filesEmpty: 'まだ提出がありません',
    fileLoadFailed: 'ファイルの取得に失敗しました',
  },
  qa: {
    lead: '提出物とこれまでのやり取りをふまえて、AIが質問します。すべての質問に回答してから送信してください。',
    generating: '質問を生成中…',
    submit: '回答を送信する',
    submitting: '送信中…',
    completed: 'すべての質問に回答しました。レポートを生成しています…',
    loadFailed: '質問の取得に失敗しました',
    submitFailed: '回答の送信に失敗しました',
    generateFailed: '質問の生成に失敗しました。再試行してください。',
    retry: '質問生成を再試行',
  },
  report: {
    title: 'フィードバックレポート',
    generating: 'レポートを生成中…',
    loadFailed: 'レポートの取得に失敗しました',
    generateFailed: 'レポートの生成に失敗しました。再試行してください。',
    retry: 'レポート生成を再試行',
    regenerate: 'レポートを再生成',
    ask: 'AIに質問',
    askPlaceholder: '選択した箇所や気になる点について質問…',
    quoteLabel: '引用',
    chatTitle: 'レポートについて質問する',
    chatEmpty: 'レポート内の不明箇所を選択して「AIに質問」を押すか、ここから直接質問できます。',
  },
} as const;
