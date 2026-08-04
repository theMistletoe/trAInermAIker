import type { QaCategory, SkillLevel, SkillProfile } from '../../shared/schemas';
import type { ChallengeContent } from '../content/types';

// Deterministic no-AI outputs for every agent role. Same input MUST produce the
// same output (no Date / Math.random): tests and the offline dev loop depend on
// it, and every real-AI failure path in agent.ts degrades here — an AI role is
// never allowed to fail outright.

const SKILL_LEVELS: readonly SkillLevel[] = ['none', 'beginner', 'intermediate', 'advanced'];

const LEVEL_SCORE: Record<SkillLevel, number> = {
  none: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

const OVERALL_LABEL_JA: Record<SkillProfile['overallLevel'], string> = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
};

const DIMENSION_NOTE = '選択式の自己申告に基づく簡易判定です。';

/** 'level-N' choice id → skill level; anything unknown or missing maps to 'none'. */
function levelFromChoice(value: string | undefined): SkillLevel {
  const match = value ? /^level-(\d+)$/.exec(value) : null;
  const index = match?.[1] !== undefined ? Number(match[1]) : -1;
  return SKILL_LEVELS[index] ?? 'none';
}

/** Short dimension label derived from the question prompt (cut at '（', drop trailing '？'). */
function shortLabel(prompt: string): string {
  const head = prompt.split('（')[0] ?? prompt;
  return head.replace(/[？?。]+$/, '').slice(0, 24);
}

export function stubSkillProfile(
  challenge: ChallengeContent,
  answers: { questionId: string; value: string }[],
): SkillProfile {
  const valueByQuestion = new Map(answers.map((a) => [a.questionId, a.value]));
  const dimensions = challenge.assessmentQuestions
    .filter((q) => q.kind === 'single_choice')
    .map((q) => ({
      id: q.id,
      label: shortLabel(q.prompt),
      level: levelFromChoice(valueByQuestion.get(q.id)),
      note: DIMENSION_NOTE,
    }));

  const total = dimensions.reduce((sum, d) => sum + LEVEL_SCORE[d.level], 0);
  const average = dimensions.length === 0 ? 0 : total / dimensions.length;
  const overallLevel: SkillProfile['overallLevel'] =
    average < 1 ? 'beginner' : average < 2.25 ? 'intermediate' : 'advanced';

  const freeTextIds = new Set(
    challenge.assessmentQuestions.filter((q) => q.kind === 'free_text').map((q) => q.id),
  );
  const goal = answers.find((a) => freeTextIds.has(a.questionId) && a.value.trim() !== '');
  const base = `AI未接続時の簡易判定です。自己申告の回答から、総合レベルは「${OVERALL_LABEL_JA[overallLevel]}」相当と判定しました。`;
  const summary = goal
    ? `${base}学習目標「${goal.value.trim()}」を意識して課題に取り組んでください。`
    : `${base}課題を通じて実践的な設計判断力を養っていきましょう。`;

  return { overallLevel, dimensions, summary };
}

const REPLY_FALLBACK =
  'うーん、難しいことはよく分からないんですが、とにかく毎月の費用はなるべく抑えたいんですよね。気になるところがあれば、もう少し具体的に聞いてもらえますか？';

// In-character 佐藤 replies: vague, cost-conscious, answers narrowly, always
// invites a more specific question so the offline chat loop stays practicable.
const REPLY_ROTATION: readonly string[] = [
  REPLY_FALLBACK,
  'そこは正直、ちゃんと決めていなかったですね……。普段はファイルの受け渡しがとにかく面倒で困っていまして。どの部分のことか、もう少し具体的に教えてもらえますか？',
  '専門的な言葉になるとちょっと自信がないんですよ。業務の言葉で言うと、社内の人だけが安全に使えれば十分かなと。気になる点をひとつずつ聞いてもらえると助かります。',
  '数字ですか……すぐには思い出せないですね、すみません。必要な数字を具体的に言ってもらえれば、こちらで確認してみますよ。',
  '情報漏えいだけは本当に怖いので、そこはなんとなくでも安全にしておいてほしいんです。ほかに確認しておきたいことはありますか？',
];

export function stubRequirementReply(userMessageCount: number): string {
  const index = userMessageCount < 1 ? 0 : (userMessageCount - 1) % REPLY_ROTATION.length;
  return REPLY_ROTATION[index] ?? REPLY_FALLBACK;
}

/** Exactly QA_QUESTIONS_MIN (3) fixed questions; fresh array per call so callers may mutate. */
export function stubQaQuestions(): { category: QaCategory; question: string }[] {
  return [
    {
      category: 'gap',
      question:
        '利用者の認証と、他人のファイルへのアクセス防止をどのように実現しましたか？具体的な仕組みを説明してください。',
    },
    {
      category: 'unasked_requirement',
      question:
        '要件確認の際に聞き漏らした点（性能目標や保存データの暗号化など）はありましたか？あるとすれば、それは設計にどう影響しますか？',
    },
    {
      category: 'learning_point',
      question:
        'ファイルを登録から90日後に自動削除する仕組みと、ファイル一覧のメタデータとの整合性をどのように設計しましたか？',
    },
  ];
}

export function stubReport(input: {
  textFileCount: number;
  qaPairs: { question: string; answer: string }[];
}): string {
  const { textFileCount, qaPairs } = input;
  return [
    '# フィードバックレポート',
    '',
    '## 総評',
    '',
    `これはAI未接続時の簡易レポートです。提出されたテキストファイル${textFileCount}件と、Q&Aでの${qaPairs.length}件の回答を受領しました。詳細な個別評価は、AI接続時に生成されます。`,
    '',
    '## 改善したほうが良い点',
    '',
    '- AI未接続のため個別の指摘は生成できません。READMEの説明とコードの実装が一致しているか、自身で見直してください。',
    '',
    '## 解釈が誤っていた点',
    '',
    '- AI未接続のため個別の指摘は生成できません。要件確認チャットで得た情報と、提出物で置いた前提を照らし合わせてください。',
    '',
    '## 理解が不足していそうな点',
    '',
    '- AI未接続のため個別の指摘は生成できません。Q&Aで回答に迷った項目を優先的に復習してください。',
    '',
    '## 次の学習ステップ',
    '',
    '- 課題の要件を読み直し、自分の設計判断の理由を文章で説明できるようにしましょう。',
    '',
  ].join('\n');
}

const QUOTE_MAX_CHARS = 80;

export function stubReportAnswer(question: string, quotedText: string | null): string {
  const quote =
    quotedText !== null && quotedText.length > QUOTE_MAX_CHARS
      ? `${quotedText.slice(0, QUOTE_MAX_CHARS)}…`
      : quotedText;
  const head =
    quote !== null ? `ご質問の『${quote}』について、` : `「${question}」というご質問について、`;
  return `${head}現在はAIに接続できないため詳細な解説を生成できません。レポート本文の該当セクションに評価の根拠を記載していますので、そちらをあわせて参照してください。`;
}
