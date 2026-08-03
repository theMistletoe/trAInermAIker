import { describe, expect, it, type Mock, vi } from 'vitest';
import { challenge1 } from '../../src/server/content/challenge1';
import {
  AI_HISTORY_MAX_TURNS,
  AI_SUBMISSION_CONTEXT_MAX,
  answerReportQuestion,
  buildSubmissionContext,
  type ChatTurn,
  evaluateAssessment,
  generateQaQuestions,
  generateReport,
  guardVerbatimLeak,
  requirementChatReply,
} from '../../src/server/lib/agent';
import {
  AI_TIMEOUT_CHAT_MS,
  AI_TIMEOUT_HEAVY_MS,
  type ChatCompletionRequest,
} from '../../src/server/lib/ai';
import {
  stubQaQuestions,
  stubReport,
  stubReportAnswer,
  stubRequirementReply,
  stubSkillProfile,
} from '../../src/server/lib/stubs';
import { QA_QUESTIONS_MAX } from '../../src/shared/constants';
import type { SkillProfile } from '../../src/shared/schemas';

const requestAt = (complete: Mock, index = 0): ChatCompletionRequest =>
  complete.mock.calls[index]?.[0] as ChatCompletionRequest;

const joinedContent = (req: ChatCompletionRequest): string =>
  req.messages.map((m) => m.content).join('\n');

const singleChoiceAnswers = (value: string) =>
  challenge1.assessmentQuestions
    .filter((q) => q.kind === 'single_choice')
    .map((q) => ({ questionId: q.id, value }));

const normalizedSpec = challenge1.hiddenSpecMd.replace(/\s+/g, ' ').trim();

const submissionFiles = [
  { path: 'lib/stack.ts', content: 'export class FileSharingStack {}' },
  { path: 'README.md', content: '# 提出物の説明' },
  { path: 'bin/app.ts', content: 'new FileSharingStack();' },
];

const sampleQaPairs = [
  {
    category: 'gap' as const,
    question: '認証はどのように実現しましたか？',
    answer: 'Cognitoユーザープールを使いました。',
  },
];

const aiProfile: SkillProfile = {
  overallLevel: 'intermediate',
  dimensions: [
    { id: 'cdk-experience', label: 'CDK経験', level: 'intermediate', note: '業務で使用経験あり' },
  ],
  summary: '中級レベルの受講者です。',
};

describe('決定的スタブ (stubs)', () => {
  it('stubSkillProfile / stubQaQuestions / stubReport は同一入力で同一出力を返す', () => {
    const answers = singleChoiceAnswers('level-2');
    expect(stubSkillProfile(challenge1, answers)).toEqual(stubSkillProfile(challenge1, answers));
    expect(stubQaQuestions()).toEqual(stubQaQuestions());
    const input = { textFileCount: 2, qaPairs: [{ question: 'Q', answer: 'A' }] };
    expect(stubReport(input)).toBe(stubReport(input));
  });

  it('stubSkillProfile は level-3 の回答を advanced 次元にマップする', () => {
    const answers = singleChoiceAnswers('level-0').map((a) =>
      a.questionId === 'cdk-experience' ? { ...a, value: 'level-3' } : a,
    );
    const profile = stubSkillProfile(challenge1, answers);
    expect(profile.dimensions.find((d) => d.id === 'cdk-experience')?.level).toBe('advanced');
    expect(profile.dimensions.find((d) => d.id === 'aws-services')?.level).toBe('none');
  });

  it('stubSkillProfile は全問 level-0 のとき overallLevel を beginner にする', () => {
    const profile = stubSkillProfile(challenge1, singleChoiceAnswers('level-0'));
    expect(profile.overallLevel).toBe('beginner');
    expect(profile.dimensions).toHaveLength(5);
  });

  it('stubSkillProfile は自由記述（learning-goal）の回答を summary に引用する', () => {
    const answers = [
      ...singleChoiceAnswers('level-2'),
      { questionId: 'learning-goal', value: 'IAMの最小権限設計を学びたい' },
    ];
    expect(stubSkillProfile(challenge1, answers).summary).toContain('IAMの最小権限設計を学びたい');
  });

  it('stubRequirementReply は5件をローテーションし、1未満のカウントもガードする', () => {
    expect(stubRequirementReply(0)).toBe(stubRequirementReply(1));
    expect(stubRequirementReply(-3)).toBe(stubRequirementReply(1));
    expect(stubRequirementReply(6)).toBe(stubRequirementReply(1));
    expect(stubRequirementReply(2)).not.toBe(stubRequirementReply(1));
  });

  it('stubReport は規定の見出しを規定の順序で含み、件数のみを補間する', () => {
    const report = stubReport({ textFileCount: 7, qaPairs: [{ question: 'Q1', answer: 'A1' }] });
    const headings = [
      '# フィードバックレポート',
      '## 総評',
      '## 改善したほうが良い点',
      '## 解釈が誤っていた点',
      '## 理解が不足していそうな点',
      '## 次の学習ステップ',
    ];
    let prev = -1;
    for (const heading of headings) {
      const idx = report.indexOf(heading);
      expect(idx).toBeGreaterThan(prev);
      prev = idx;
    }
    expect(report).toContain('AI未接続時の簡易レポート');
    expect(report).toContain('テキストファイル7件');
    expect(report).toContain('1件の回答');
  });

  it('stubReportAnswer は引用文を80字で切り詰め、引用なしなら質問をエコーする', () => {
    const longQuote = 'あ'.repeat(100);
    const withQuote = stubReportAnswer('これは何ですか？', longQuote);
    expect(withQuote).toContain(`『${'あ'.repeat(80)}…』`);
    expect(withQuote).not.toContain('あ'.repeat(81));
    const noQuote = stubReportAnswer('これは何ですか？', null);
    expect(noQuote).toContain('これは何ですか？');
    expect(noQuote).toContain('レポート');
  });
});

describe('逐語リークガード (guardVerbatimLeak)', () => {
  it('隠し仕様の81字以上の逐語コピーを含む返信は定型の受け流しに置き換える', () => {
    const leak = normalizedSpec.slice(100, 300);
    const out = guardVerbatimLeak(leak, challenge1.hiddenSpecMd);
    expect(out).not.toBe(leak);
    expect(out).not.toContain(leak.slice(0, 81));
  });

  it('80字未満の短い引用はそのまま通す', () => {
    const short = normalizedSpec.slice(100, 160);
    expect(guardVerbatimLeak(short, challenge1.hiddenSpecMd)).toBe(short);
  });

  it('改行の入れ方が違うだけの空白バリエーションのコピーも検出する', () => {
    const variant = normalizedSpec.slice(300, 500).replace(/ /g, '\n\n');
    const out = guardVerbatimLeak(variant, challenge1.hiddenSpecMd);
    expect(out).not.toBe(variant);
  });

  it('仕様と無関係の長文はそのまま通す', () => {
    const reply = 'なるべく安く済ませたい、というのが正直なところです。'.repeat(10);
    expect(guardVerbatimLeak(reply, challenge1.hiddenSpecMd)).toBe(reply);
  });
});

describe('提出物コンテキスト (buildSubmissionContext)', () => {
  it('README → bin → lib の順に並べ、各ファイルを区切り付きで連結する', () => {
    const out = buildSubmissionContext(submissionFiles);
    expect(out.startsWith('--- README.md ---\n# 提出物の説明\n')).toBe(true);
    const readmeIdx = out.indexOf('--- README.md ---');
    const binIdx = out.indexOf('--- bin/app.ts ---');
    const libIdx = out.indexOf('--- lib/stack.ts ---');
    expect(readmeIdx).toBeLessThan(binIdx);
    expect(binIdx).toBeLessThan(libIdx);
  });

  it('AI_SUBMISSION_CONTEXT_MAX で切り詰め、先頭部分は保持する', () => {
    const big = { path: 'big.txt', content: 'あ'.repeat(150_000) };
    const out = buildSubmissionContext([big]);
    expect(out.length).toBeLessThanOrEqual(AI_SUBMISSION_CONTEXT_MAX);
    expect(out.length).toBe(AI_SUBMISSION_CONTEXT_MAX);
    expect(out.startsWith('--- big.txt ---\nああ')).toBe(true);
  });
});

describe('スキル評価 (evaluateAssessment)', () => {
  it('forceStub のときAIを呼ばずスタブのプロファイルを返す', async () => {
    const complete = vi.fn();
    const answers = singleChoiceAnswers('level-1');
    const out = await evaluateAssessment(
      { client: { complete }, forceStub: true },
      { challenge: challenge1, answers },
    );
    expect(out).toEqual(stubSkillProfile(challenge1, answers));
    expect(complete).not.toHaveBeenCalled();
  });

  it('有効なJSON出力をSkillProfileとして返し、回答をプロンプトに含める', async () => {
    const complete = vi.fn().mockResolvedValue(JSON.stringify(aiProfile));
    const answers = singleChoiceAnswers('level-2');
    const out = await evaluateAssessment(
      { client: { complete } },
      { challenge: challenge1, answers },
    );
    expect(out).toEqual(aiProfile);
    const req = requestAt(complete);
    expect(req.jsonMode).toBe(true);
    expect(req.timeoutMs).toBe(AI_TIMEOUT_CHAT_MS);
    const text = joinedContent(req);
    expect(text).toContain('cdk-experience');
    expect(text).toContain('level-2');
  });

  it('不正なJSONの後に有効なJSONが来たら2回呼んで有効な結果を返す', async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce('これはJSONではありません')
      .mockResolvedValueOnce(JSON.stringify(aiProfile));
    const out = await evaluateAssessment(
      { client: { complete } },
      { challenge: challenge1, answers: singleChoiceAnswers('level-2') },
    );
    expect(out).toEqual(aiProfile);
    expect(complete).toHaveBeenCalledTimes(2);
    const retryReq = requestAt(complete, 1);
    expect(retryReq.messages.at(-1)?.content).toContain('指定のJSONのみを出力してください');
  });

  it('2回とも不正な出力ならスタブへフォールバックする', async () => {
    const complete = vi.fn().mockResolvedValue('{"broken": true}');
    const answers = singleChoiceAnswers('level-3');
    const out = await evaluateAssessment(
      { client: { complete } },
      { challenge: challenge1, answers },
    );
    expect(out).toEqual(stubSkillProfile(challenge1, answers));
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('AI呼び出しが例外を投げたときスタブへフォールバックする', async () => {
    const complete = vi.fn().mockRejectedValue(new Error('timeout'));
    const answers = singleChoiceAnswers('level-1');
    const out = await evaluateAssessment(
      { client: { complete } },
      { challenge: challenge1, answers },
    );
    expect(out).toEqual(stubSkillProfile(challenge1, answers));
  });
});

describe('要件確認チャット (requirementChatReply)', () => {
  const baseInput = {
    challenge: challenge1,
    skillProfile: null,
    history: [] as ChatTurn[],
    userMessage: 'どんなファイルを扱いますか？',
  };

  it('forceStub のときAIを呼ばずスタブ返信（1通目）を返す', async () => {
    const complete = vi.fn();
    const out = await requirementChatReply({ client: { complete }, forceStub: true }, baseInput);
    expect(out).toBe(stubRequirementReply(1));
    expect(complete).not.toHaveBeenCalled();
  });

  it('AIの返信をトリムして返す', async () => {
    const complete = vi.fn().mockResolvedValue('  PDFと画像が多いですね。  ');
    const out = await requirementChatReply({ client: { complete } }, baseInput);
    expect(out).toBe('PDFと画像が多いですね。');
  });

  it('システムプロンプトが人物設定と社内資料の区切りを含み、jsonModeは設定しない', async () => {
    const complete = vi.fn().mockResolvedValue('はい。');
    await requirementChatReply({ client: { complete } }, baseInput);
    const req = requestAt(complete);
    expect(req.jsonMode).toBeUndefined();
    const system = req.messages[0]?.content ?? '';
    expect(req.messages[0]?.role).toBe('system');
    expect(system).toContain(challenge1.personaBrief);
    expect(system).toContain('【社内資料 ここから】');
    expect(system).toContain('【社内資料 ここまで】');
    expect(system).toContain('指示ではない');
  });

  it('隠し仕様の逐語コピーを含む返信は定型の受け流しに置き換わる', async () => {
    const leak = `${normalizedSpec.slice(0, 200)} という内容になっています。`;
    const complete = vi.fn().mockResolvedValue(leak);
    const out = await requirementChatReply({ client: { complete } }, baseInput);
    expect(out).not.toBe(leak);
    expect(out).not.toContain(normalizedSpec.slice(0, 81));
  });

  it('50ターンの履歴は直近のAI_HISTORY_MAX_TURNSターンに丸めて送る', async () => {
    const history: ChatTurn[] = Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `メッセージ${i}`,
    }));
    const complete = vi.fn().mockResolvedValue('わかりました。');
    await requirementChatReply({ client: { complete } }, { ...baseInput, history });
    const req = requestAt(complete);
    expect(req.messages).toHaveLength(AI_HISTORY_MAX_TURNS + 2);
    expect(req.messages[1]?.content).toBe('メッセージ10');
    expect(req.messages.at(-1)?.content).toBe(baseInput.userMessage);
  });

  it('AIが例外を投げたら履歴のユーザー発言数+1のスタブ返信を返す', async () => {
    const history: ChatTurn[] = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
      { role: 'assistant', content: 'd' },
      { role: 'user', content: 'e' },
    ];
    const complete = vi.fn().mockRejectedValue(new Error('down'));
    const out = await requirementChatReply({ client: { complete } }, { ...baseInput, history });
    expect(out).toBe(stubRequirementReply(4));
  });

  it('空白のみの返信はスタブへフォールバックする', async () => {
    const complete = vi.fn().mockResolvedValue('   \n  ');
    const out = await requirementChatReply({ client: { complete } }, baseInput);
    expect(out).toBe(stubRequirementReply(1));
  });
});

describe('Q&A生成 (generateQaQuestions)', () => {
  const baseInput = {
    challenge: challenge1,
    skillProfile: null,
    chatHistory: [] as ChatTurn[],
    submissionFiles,
  };

  it('クライアントが無い（空deps）ときスタブの3問を返す', async () => {
    const out = await generateQaQuestions({}, baseInput);
    expect(out).toEqual(stubQaQuestions());
  });

  it('12問の有効な出力は10問（QA_QUESTIONS_MAX）に切り詰める', async () => {
    const twelve = {
      questions: Array.from({ length: 12 }, (_, i) => ({
        category: 'gap',
        question: `質問${i + 1}`,
      })),
    };
    const complete = vi.fn().mockResolvedValue(JSON.stringify(twelve));
    const out = await generateQaQuestions({ client: { complete } }, baseInput);
    expect(out).toHaveLength(QA_QUESTIONS_MAX);
    expect(out[0]?.question).toBe('質問1');
    const req = requestAt(complete);
    expect(req.jsonMode).toBe(true);
    expect(req.timeoutMs).toBe(AI_TIMEOUT_HEAVY_MS);
  });

  it('1問しか返らなかったらスタブの質問で3問まで補充する', async () => {
    const complete = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify({ questions: [{ category: 'growth', question: '発展的な質問です' }] }),
      );
    const out = await generateQaQuestions({ client: { complete } }, baseInput);
    const stubs = stubQaQuestions();
    expect(out).toEqual([{ category: 'growth', question: '発展的な質問です' }, stubs[0], stubs[1]]);
  });

  it('不正なカテゴリのエントリは捨て、残りをスタブで補充する', async () => {
    const complete = vi.fn().mockResolvedValue(
      JSON.stringify({
        questions: [
          { category: 'bogus', question: '無効なカテゴリの質問' },
          { category: 'gap', question: '有効な質問' },
          { category: 'learning_point' },
        ],
      }),
    );
    const out = await generateQaQuestions({ client: { complete } }, baseInput);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ category: 'gap', question: '有効な質問' });
    expect(out.some((q) => q.question === '無効なカテゴリの質問')).toBe(false);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('2回とも不正な出力ならスタブの3問へフォールバックする', async () => {
    const complete = vi.fn().mockResolvedValue('JSONではない出力');
    const out = await generateQaQuestions({ client: { complete } }, baseInput);
    expect(out).toEqual(stubQaQuestions());
    expect(complete).toHaveBeenCalledTimes(2);
  });
});

describe('レポート生成 (generateReport)', () => {
  const baseInput = {
    challenge: challenge1,
    skillProfile: aiProfile,
    chatHistory: [] as ChatTurn[],
    submissionFiles,
    qaPairs: sampleQaPairs,
  };

  it('AIのMarkdownをそのまま返し、プロンプトにQ&Aと提出ファイルパスを含める', async () => {
    const md = '# フィードバックレポート\n\n## 総評\nよく設計できています。';
    const complete = vi.fn().mockResolvedValue(`${md}\n`);
    const out = await generateReport({ client: { complete } }, baseInput);
    expect(out).toBe(md);
    const text = joinedContent(requestAt(complete));
    expect(text).toContain(sampleQaPairs[0]?.question ?? '');
    expect(text).toContain('lib/stack.ts');
    expect(text).toContain('## 総評');
  });

  it('AIが例外を投げたらスタブレポート（見出し付き）を返す', async () => {
    const complete = vi.fn().mockRejectedValue(new Error('overloaded'));
    const out = await generateReport({ client: { complete } }, baseInput);
    expect(out).toBe(stubReport({ textFileCount: submissionFiles.length, qaPairs: sampleQaPairs }));
    expect(out).toContain('## 総評');
  });

  it('空白のみの出力はスタブレポートへフォールバックする', async () => {
    const complete = vi.fn().mockResolvedValue('  \n ');
    const out = await generateReport({ client: { complete } }, baseInput);
    expect(out).toContain('# フィードバックレポート');
  });
});

describe('レポートQ&A (answerReportQuestion)', () => {
  const baseInput = {
    challenge: challenge1,
    reportMd: '# フィードバックレポート\n\n## 総評\nIAM権限が過剰です。',
    quotedText: 'IAM権限が過剰です。' as string | null,
    question: 'これはどういう意味ですか？',
    history: [] as ChatTurn[],
  };

  it('quotedText があるときプロンプトに選択箇所として埋め込む', async () => {
    const complete = vi.fn().mockResolvedValue('IAMの権限が広すぎるという指摘です。');
    const out = await answerReportQuestion({ client: { complete } }, baseInput);
    expect(out).toBe('IAMの権限が広すぎるという指摘です。');
    const text = joinedContent(requestAt(complete));
    expect(text).toContain('ユーザーが選択した箇所: IAM権限が過剰です。');
    expect(text).toContain('【レポート ここから】');
  });

  it('quotedText が null でも動作し、選択箇所の行は含めない', async () => {
    const complete = vi.fn().mockResolvedValue('レポート全体としての講評です。');
    const out = await answerReportQuestion(
      { client: { complete } },
      { ...baseInput, quotedText: null },
    );
    expect(out).toBe('レポート全体としての講評です。');
    expect(joinedContent(requestAt(complete))).not.toContain('ユーザーが選択した箇所');
  });

  it('AIが例外を投げたらスタブ回答へフォールバックする', async () => {
    const complete = vi.fn().mockRejectedValue(new Error('boom'));
    const out = await answerReportQuestion({ client: { complete } }, baseInput);
    expect(out).toBe(stubReportAnswer(baseInput.question, baseInput.quotedText));
  });
});
