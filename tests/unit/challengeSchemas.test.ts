import { ASSESSMENT_ANSWER_MAX, CHAT_MESSAGE_MAX } from '@shared/constants';
import {
  answerQaBodySchema,
  apiErrorBodySchema,
  apiErrorCodeEnum,
  askReportBodySchema,
  attemptPhaseEnum,
  attemptSchema,
  challengeIdParamSchema,
  createAttemptBodySchema,
  postChatBodySchema,
  qaQuestionSchema,
  skillProfileSchema,
  submissionFileQuerySchema,
  submissionFormSchema,
  submitAssessmentBodySchema,
} from '@shared/schemas';
import { describe, expect, it } from 'vitest';

const validSkillProfile = {
  overallLevel: 'intermediate',
  dimensions: [
    { id: 'design', label: '設計', level: 'none', note: '経験なし' },
    { id: 'impl', label: '実装', level: 'beginner', note: '基礎はある' },
    { id: 'test', label: 'テスト', level: 'intermediate', note: '一通り書ける' },
    { id: 'ops', label: '運用', level: 'advanced', note: '実務経験豊富' },
  ],
  summary: '全体としては中級',
};

const validAttempt = {
  id: 1,
  challengeId: 'aws-cdk-file-sharing',
  phase: 'assessment',
  skillProfile: null,
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

describe('チャレンジIDのパラメータスキーマ (challengeIdParamSchema)', () => {
  it('小文字ケバブケースのidを受け入れる', () => {
    expect(challengeIdParamSchema.safeParse({ id: 'aws-cdk-file-sharing' }).success).toBe(true);
  });

  it('大文字を含むidを拒否する', () => {
    expect(challengeIdParamSchema.safeParse({ id: 'AWS_CDK' }).success).toBe(false);
  });

  it('スラッシュを含むidを拒否する', () => {
    expect(challengeIdParamSchema.safeParse({ id: 'a/b' }).success).toBe(false);
  });

  it('空文字列のidを拒否する', () => {
    expect(challengeIdParamSchema.safeParse({ id: '' }).success).toBe(false);
  });
});

describe('アテンプトのフェーズ列挙 (attemptPhaseEnum)', () => {
  it('5つのフェーズをすべて受け入れる', () => {
    for (const phase of ['assessment', 'requirement_chat', 'submission', 'qa', 'report']) {
      expect(attemptPhaseEnum.safeParse(phase).success).toBe(true);
    }
  });

  it('未定義のフェーズを拒否する', () => {
    expect(attemptPhaseEnum.safeParse('completed').success).toBe(false);
  });
});

describe('アテンプト作成リクエストのボディスキーマ (createAttemptBodySchema)', () => {
  it('有効なスラグのchallengeIdを受け入れる', () => {
    const r = createAttemptBodySchema.safeParse({ challengeId: 'aws-cdk-file-sharing' });
    expect(r.success).toBe(true);
  });

  it('大文字を含むchallengeIdを拒否する', () => {
    expect(createAttemptBodySchema.safeParse({ challengeId: 'AWS-CDK' }).success).toBe(false);
  });

  it('空文字列のchallengeIdを拒否する', () => {
    expect(createAttemptBodySchema.safeParse({ challengeId: '' }).success).toBe(false);
  });
});

describe('アセスメント提出リクエストのボディスキーマ (submitAssessmentBodySchema)', () => {
  it('valueをトリムした値で受け入れる', () => {
    const r = submitAssessmentBodySchema.safeParse({
      answers: [{ questionId: 'q1', value: '  answer  ' }],
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.answers[0]?.value).toBe('answer');
  });

  it('空のanswers配列を拒否する', () => {
    expect(submitAssessmentBodySchema.safeParse({ answers: [] }).success).toBe(false);
  });

  it('空白文字のみのvalueを拒否する', () => {
    const r = submitAssessmentBodySchema.safeParse({
      answers: [{ questionId: 'q1', value: '   \n\t  ' }],
    });
    expect(r.success).toBe(false);
  });

  it('上限を超えるvalueを拒否する', () => {
    const r = submitAssessmentBodySchema.safeParse({
      answers: [{ questionId: 'q1', value: 'あ'.repeat(ASSESSMENT_ANSWER_MAX + 1) }],
    });
    expect(r.success).toBe(false);
  });

  it('questionIdの欠落を拒否する', () => {
    expect(submitAssessmentBodySchema.safeParse({ answers: [{ value: 'answer' }] }).success).toBe(
      false,
    );
  });
});

describe('要件チャット投稿リクエストのボディスキーマ (postChatBodySchema)', () => {
  it('messageをトリムした値で受け入れる', () => {
    const r = postChatBodySchema.safeParse({ message: '  hello  ' });
    expect(r.success).toBe(true);
    expect(r.success && r.data.message).toBe('hello');
  });

  it('トリム後に空になるmessageを拒否する', () => {
    expect(postChatBodySchema.safeParse({ message: '   ' }).success).toBe(false);
  });

  it('上限を超えるmessageを拒否する', () => {
    const r = postChatBodySchema.safeParse({ message: 'あ'.repeat(CHAT_MESSAGE_MAX + 1) });
    expect(r.success).toBe(false);
  });

  it('ちょうど上限文字数のmessageを受け入れる', () => {
    const r = postChatBodySchema.safeParse({ message: 'あ'.repeat(CHAT_MESSAGE_MAX) });
    expect(r.success).toBe(true);
  });
});

describe('QA回答リクエストのボディスキーマ (answerQaBodySchema)', () => {
  it('answerをトリムした値で受け入れる', () => {
    const r = answerQaBodySchema.safeParse({ answer: '  こう考えました  ' });
    expect(r.success).toBe(true);
    expect(r.success && r.data.answer).toBe('こう考えました');
  });

  it('トリム後に空になるanswerを拒否する', () => {
    expect(answerQaBodySchema.safeParse({ answer: ' \n\t ' }).success).toBe(false);
  });

  it('上限を超えるanswerを拒否する', () => {
    const r = answerQaBodySchema.safeParse({ answer: 'あ'.repeat(CHAT_MESSAGE_MAX + 1) });
    expect(r.success).toBe(false);
  });

  it('ちょうど上限文字数のanswerを受け入れる', () => {
    const r = answerQaBodySchema.safeParse({ answer: 'あ'.repeat(CHAT_MESSAGE_MAX) });
    expect(r.success).toBe(true);
  });
});

describe('レポート質問リクエストのボディスキーマ (askReportBodySchema)', () => {
  it('quotedTextに文字列を受け入れる', () => {
    const r = askReportBodySchema.safeParse({ question: 'なぜ？', quotedText: '引用部分' });
    expect(r.success).toBe(true);
  });

  it('quotedTextにnullを受け入れる', () => {
    const r = askReportBodySchema.safeParse({ question: 'なぜ？', quotedText: null });
    expect(r.success).toBe(true);
  });

  it('quotedTextの省略を拒否する (nullableでありoptionalではない)', () => {
    expect(askReportBodySchema.safeParse({ question: 'なぜ？' }).success).toBe(false);
  });

  it('questionをトリムした値で受け入れる', () => {
    const r = askReportBodySchema.safeParse({ question: '  なぜ？  ', quotedText: null });
    expect(r.success).toBe(true);
    expect(r.success && r.data.question).toBe('なぜ？');
  });

  it('トリム後に空になるquestionを拒否する', () => {
    expect(askReportBodySchema.safeParse({ question: '   ', quotedText: null }).success).toBe(
      false,
    );
  });

  it('上限を超えるquestionを拒否する', () => {
    const r = askReportBodySchema.safeParse({
      question: 'あ'.repeat(CHAT_MESSAGE_MAX + 1),
      quotedText: null,
    });
    expect(r.success).toBe(false);
  });
});

describe('提出フォームのスキーマ (submissionFormSchema)', () => {
  it('Fileインスタンスを受け入れる', () => {
    const r = submissionFormSchema.safeParse({ file: new File(['x'], 'a.zip') });
    expect(r.success).toBe(true);
  });

  it('File以外の値を拒否する', () => {
    expect(submissionFormSchema.safeParse({ file: 'not-a-file' }).success).toBe(false);
  });
});

describe('提出ファイル取得クエリのスキーマ (submissionFileQuerySchema)', () => {
  it('空のpathを拒否する', () => {
    expect(submissionFileQuerySchema.safeParse({ path: '' }).success).toBe(false);
  });
});

describe('アテンプトのエンティティスキーマ (attemptSchema)', () => {
  it('skillProfileがnullのアテンプトを受け入れる', () => {
    expect(attemptSchema.safeParse(validAttempt).success).toBe(true);
  });

  it('完全なskillProfileを持つアテンプトを受け入れる', () => {
    const r = attemptSchema.safeParse({ ...validAttempt, skillProfile: validSkillProfile });
    expect(r.success).toBe(true);
  });

  it('未知のフェーズを拒否する', () => {
    expect(attemptSchema.safeParse({ ...validAttempt, phase: 'completed' }).success).toBe(false);
  });
});

describe('スキルプロファイルのスキーマ (skillProfileSchema)', () => {
  it('不正なoverallLevelを拒否する', () => {
    const r = skillProfileSchema.safeParse({ ...validSkillProfile, overallLevel: 'expert' });
    expect(r.success).toBe(false);
  });

  it('4種類すべてのレベルを含むdimensionsを受け入れる', () => {
    expect(skillProfileSchema.safeParse(validSkillProfile).success).toBe(true);
  });
});

describe('QA質問のエンティティスキーマ (qaQuestionSchema)', () => {
  it('answerとansweredAtがnullの未回答質問を受け入れる', () => {
    const r = qaQuestionSchema.safeParse({
      id: 1,
      questionNo: 1,
      category: 'gap',
      question: 'なぜこの構成にしましたか？',
      answer: null,
      answeredAt: null,
    });
    expect(r.success).toBe(true);
  });

  it('不正なcategoryを拒否する', () => {
    const r = qaQuestionSchema.safeParse({
      id: 1,
      questionNo: 1,
      category: 'trivia',
      question: 'なぜこの構成にしましたか？',
      answer: null,
      answeredAt: null,
    });
    expect(r.success).toBe(false);
  });
});

describe('APIエラーコードの列挙 (apiErrorCodeEnum)', () => {
  it('チャレンジ関連の新しいエラーコードを受け入れる', () => {
    const codes = [
      'ATTEMPT_NOT_FOUND',
      'INVALID_PHASE',
      'INVALID_ZIP',
      'QA_COMPLETED',
      'CHAT_LIMIT_EXCEEDED',
    ];
    for (const code of codes) {
      expect(apiErrorCodeEnum.safeParse(code).success).toBe(true);
    }
  });

  it('未知のエラーコードはINTERNAL_ERRORに吸収する', () => {
    const r = apiErrorBodySchema.safeParse({ error: 'BRAND_NEW_CODE' });
    expect(r.success).toBe(true);
    expect(r.success && r.data.error).toBe('INTERNAL_ERROR');
  });
});
