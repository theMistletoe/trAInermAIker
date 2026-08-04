import {
  type AssessmentQuestion,
  type Attempt,
  assessmentQuestionSchema,
  attemptSchema,
  type ChallengeDetail,
  type ChallengeSummary,
  type ChatMessage,
  challengeDetailSchema,
  challengeSummarySchema,
  chatMessageSchema,
  type QaQuestion,
  qaQuestionSchema,
  type Report,
  type ReportMessage,
  reportMessageSchema,
  reportSchema,
  type SkillProfile,
  type Submission,
  type SubmissionFileMeta,
  skillProfileSchema,
  submissionFileMetaSchema,
  submissionSchema,
} from '../../src/shared/schemas';

// Factories run their result through the entity schema. If the schema drifts
// from the shape we synthesize here, every test that uses a factory will fail
// at the parse step rather than papering over the contract.

// --- challenges ---

export const buildChallengeSummary = (over: Partial<ChallengeSummary> = {}): ChallengeSummary =>
  challengeSummarySchema.parse({
    id: 'todo-app',
    title: 'TODOアプリを作る',
    category: 'frontend',
    summary: 'ヒアリングで要件を固めてから TODO アプリを実装する課題',
    ...over,
  });

export const buildChallengeDetail = (over: Partial<ChallengeDetail> = {}): ChallengeDetail =>
  challengeDetailSchema.parse({
    ...buildChallengeSummary(),
    descriptionMd:
      '# 課題概要\n\n発注者にヒアリングし、TODO アプリを実装してください。\n\n```typescript\ninterface Todo {\n  id: number;\n  title: string;\n}\n```\n',
    submissionGuideMd: '成果物一式を zip にまとめて提出してください。',
    ...over,
  });

// --- attempts ---

export const buildSkillProfile = (over: Partial<SkillProfile> = {}): SkillProfile =>
  skillProfileSchema.parse({
    overallLevel: 'intermediate',
    dimensions: [
      {
        id: 'typescript',
        label: 'TypeScript',
        level: 'intermediate',
        note: '型の基本は理解している',
      },
      { id: 'testing', label: 'テスト', level: 'beginner', note: '自動テストの経験は浅い' },
    ],
    summary: '実装は自走できるがテスト設計に伸びしろがある',
    ...over,
  });

export const buildAttempt = (over: Partial<Attempt> = {}): Attempt =>
  attemptSchema.parse({
    id: 1,
    challengeId: 'todo-app',
    phase: 'assessment',
    skillProfile: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });

// --- assessment ---

export const buildAssessmentQuestion = (
  over: Partial<AssessmentQuestion> = {},
): AssessmentQuestion =>
  assessmentQuestionSchema.parse({
    id: 'q1',
    prompt: 'TypeScript の経験はどのくらいですか？',
    kind: 'single_choice',
    choices: [
      { id: 'c1', label: '未経験' },
      { id: 'c2', label: '1年未満' },
      { id: 'c3', label: '1〜3年' },
      { id: 'c4', label: '3年以上' },
    ],
    ...over,
  });

export const buildAssessmentQuestions = (): AssessmentQuestion[] => [
  buildAssessmentQuestion(),
  buildAssessmentQuestion({
    id: 'q2',
    prompt: '直近で作ったものを具体的に教えてください',
    kind: 'free_text',
    choices: null,
  }),
];

// --- requirement chat ---

export const buildChatMessage = (over: Partial<ChatMessage> = {}): ChatMessage =>
  chatMessageSchema.parse({
    id: 1,
    role: 'assistant',
    content: 'こんにちは。作りたいものについて質問してください。',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });

// --- submission ---

export const buildSubmissionFileMeta = (
  over: Partial<SubmissionFileMeta> = {},
): SubmissionFileMeta =>
  submissionFileMetaSchema.parse({
    path: 'src/index.ts',
    size: 120,
    isTruncated: false,
    ...over,
  });

export const buildSubmission = (over: Partial<Submission> = {}): Submission =>
  submissionSchema.parse({
    id: 1,
    zipName: 'submission.zip',
    zipSize: 2048,
    entryCount: 2,
    textFileCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    files: [buildSubmissionFileMeta(), buildSubmissionFileMeta({ path: 'README.md', size: 64 })],
    ...over,
  });

// --- qa ---

export const buildQaQuestion = (over: Partial<QaQuestion> = {}): QaQuestion =>
  qaQuestionSchema.parse({
    id: 1,
    questionNo: 1,
    category: 'gap',
    question: 'この実装方法を選んだ理由を教えてください。',
    answer: null,
    answeredAt: null,
    ...over,
  });

// --- report ---

export const buildReport = (over: Partial<Report> = {}): Report =>
  reportSchema.parse({
    contentMd:
      '## 総評\n\n要件の把握が的確で、実装も堅実でした。\n\n```typescript\nconst score = 80;\n```\n',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });

export const buildReportMessage = (over: Partial<ReportMessage> = {}): ReportMessage =>
  reportMessageSchema.parse({
    id: 1,
    role: 'assistant',
    content: 'ご質問ありがとうございます。該当箇所について補足します。',
    quotedText: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });
