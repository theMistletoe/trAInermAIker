import { z } from 'zod';
import { QA_QUESTIONS_MAX, QA_QUESTIONS_MIN } from '../../shared/constants';
import {
  type QaCategory,
  qaCategoryEnum,
  type SkillProfile,
  skillProfileSchema,
} from '../../shared/schemas';
import type { ChallengeContent } from '../content/types';
import {
  AI_TIMEOUT_CHAT_MS,
  AI_TIMEOUT_HEAVY_MS,
  type AiDeps,
  type ChatCompletionRequest,
  type OpenAiClient,
} from './ai';
import {
  buildAssessmentEvalMessages,
  buildQaGenMessages,
  buildReportMessages,
  buildReportQaMessages,
  buildRequirementChatMessages,
} from './prompts';
import {
  stubQaQuestions,
  stubReport,
  stubReportAnswer,
  stubRequirementReply,
  stubSkillProfile,
} from './stubs';

// AI agent roles. Contract: NEVER throw for AI reasons — every role degrades to
// its deterministic stub on missing client, timeout, transport error, or
// schema-invalid output. Callers can treat these as infallible.

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export const AI_SUBMISSION_CONTEXT_MAX = 100_000; // chars
export const AI_HISTORY_MAX_TURNS = 40;

const LEAK_WINDOW_CHARS = 81;
// Windows overlap by more than half, so any verbatim run comfortably longer
// than the window still contains at least one sampled window.
const LEAK_SCAN_STEP = 40;

const LEAK_DEFLECTION =
  'うーん、その話は一度に全部はお伝えしきれないですね……。すみません、うまくまとめられなくて。気になっている点を、もう少し具体的に質問してもらえますか？';

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Last line of defense for the requirement-chat persona: if the model pastes a
 * long verbatim run of the hidden spec despite the prompt rules, replace the
 * whole reply with a canned in-character deflection.
 */
export function guardVerbatimLeak(reply: string, hiddenSpecMd: string): string {
  const normReply = normalizeWhitespace(reply);
  const normSpec = normalizeWhitespace(hiddenSpecMd);
  if (normReply.length < LEAK_WINDOW_CHARS) return reply;
  const lastStart = normReply.length - LEAK_WINDOW_CHARS;
  for (let i = 0; ; i += LEAK_SCAN_STEP) {
    const start = Math.min(i, lastStart);
    if (normSpec.includes(normReply.slice(start, start + LEAK_WINDOW_CHARS))) {
      return LEAK_DEFLECTION;
    }
    if (start >= lastStart) break;
  }
  return reply;
}

/**
 * Concatenate submission files for prompt embedding: README* first, then
 * bin/**, lib/**, then the rest (each group sorted by path), truncated to
 * AI_SUBMISSION_CONTEXT_MAX chars so a huge zip cannot blow the token budget.
 */
export function buildSubmissionContext(files: { path: string; content: string }[]): string {
  const groupOf = (path: string): number => {
    const base = path.split('/').at(-1) ?? path;
    if (base.toUpperCase().startsWith('README')) return 0;
    if (path.startsWith('bin/') || path.includes('/bin/')) return 1;
    if (path.startsWith('lib/') || path.includes('/lib/')) return 2;
    return 3;
  };
  const ordered = [...files].sort((a, b) => {
    const byGroup = groupOf(a.path) - groupOf(b.path);
    if (byGroup !== 0) return byGroup;
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  });
  let out = '';
  for (const file of ordered) {
    const remaining = AI_SUBMISSION_CONTEXT_MAX - out.length;
    if (remaining <= 0) break;
    const chunk = `--- ${file.path} ---\n${file.content}\n`;
    if (chunk.length <= remaining) {
      out += chunk;
    } else {
      out += chunk.slice(0, remaining);
      break;
    }
  }
  return out;
}

function capHistory(history: ChatTurn[]): ChatTurn[] {
  return history.length > AI_HISTORY_MAX_TURNS ? history.slice(-AI_HISTORY_MAX_TURNS) : history;
}

const RETRY_JSON_PROMPT =
  '前回の出力はスキーマに一致しませんでした。指定のJSONのみを出力してください。';

function parseJsonWith<T>(raw: string, schema: z.ZodType<T>): T | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = schema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/**
 * JSON-mode completion with one corrective retry: on parse/validation failure
 * the model sees its own bad output plus a fix-it instruction. Second failure
 * returns null (caller falls back to its stub). Transport errors propagate to
 * the caller's catch.
 */
async function completeJsonWithRetry<T>(
  client: OpenAiClient,
  req: ChatCompletionRequest,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const first = await client.complete(req);
  const firstParsed = parseJsonWith(first, schema);
  if (firstParsed !== null) return firstParsed;
  const retried = await client.complete({
    ...req,
    messages: [
      ...req.messages,
      { role: 'assistant', content: first },
      { role: 'user', content: RETRY_JSON_PROMPT },
    ],
  });
  return parseJsonWith(retried, schema);
}

export async function evaluateAssessment(
  deps: AiDeps,
  input: {
    challenge: ChallengeContent;
    answers: { questionId: string; value: string }[];
  },
): Promise<SkillProfile> {
  const { challenge, answers } = input;
  if (deps.forceStub || !deps.client) return stubSkillProfile(challenge, answers);
  try {
    const profile = await completeJsonWithRetry(
      deps.client,
      {
        messages: buildAssessmentEvalMessages(challenge, answers),
        jsonMode: true,
        maxCompletionTokens: 2048,
        timeoutMs: AI_TIMEOUT_CHAT_MS,
      },
      skillProfileSchema,
    );
    if (profile) return profile;
    console.error('evaluateAssessment: AI output failed schema validation, falling back to stub');
  } catch (e) {
    console.error('evaluateAssessment: AI call failed, falling back to stub', e);
  }
  return stubSkillProfile(challenge, answers);
}

export async function requirementChatReply(
  deps: AiDeps,
  input: {
    challenge: ChallengeContent;
    skillProfile: SkillProfile | null;
    history: ChatTurn[];
    userMessage: string;
  },
): Promise<string> {
  const { challenge, skillProfile, history, userMessage } = input;
  const userTurnCount = history.filter((t) => t.role === 'user').length;
  if (deps.forceStub || !deps.client) return stubRequirementReply(userTurnCount + 1);
  try {
    const raw = await deps.client.complete({
      messages: buildRequirementChatMessages(
        challenge,
        skillProfile,
        capHistory(history),
        userMessage,
      ),
      maxCompletionTokens: 1024,
      timeoutMs: AI_TIMEOUT_CHAT_MS,
    });
    const reply = raw.trim();
    if (!reply) return stubRequirementReply(userTurnCount + 1);
    return guardVerbatimLeak(reply, challenge.hiddenSpecMd);
  } catch (e) {
    console.error('requirementChatReply: AI call failed, falling back to stub', e);
    return stubRequirementReply(userTurnCount + 1);
  }
}

const qaEntrySchema = z.object({ category: qaCategoryEnum, question: z.string().min(1) });
// Envelope is lenient on purpose: individually invalid entries are dropped in
// post-processing instead of failing the whole generation.
const qaEnvelopeSchema = z.object({ questions: z.array(z.unknown()) });

export async function generateQaQuestions(
  deps: AiDeps,
  input: {
    challenge: ChallengeContent;
    skillProfile: SkillProfile | null;
    chatHistory: ChatTurn[];
    submissionFiles: { path: string; content: string }[];
  },
): Promise<{ category: QaCategory; question: string }[]> {
  const { challenge, skillProfile, chatHistory, submissionFiles } = input;
  if (deps.forceStub || !deps.client) return stubQaQuestions();
  try {
    const envelope = await completeJsonWithRetry(
      deps.client,
      {
        messages: buildQaGenMessages(
          challenge,
          skillProfile,
          capHistory(chatHistory),
          buildSubmissionContext(submissionFiles),
        ),
        jsonMode: true,
        maxCompletionTokens: 4096,
        timeoutMs: AI_TIMEOUT_HEAVY_MS,
      },
      qaEnvelopeSchema,
    );
    if (envelope) {
      const valid: { category: QaCategory; question: string }[] = [];
      for (const entry of envelope.questions) {
        const parsed = qaEntrySchema.safeParse(entry);
        if (parsed.success) valid.push(parsed.data);
      }
      const questions = valid.slice(0, QA_QUESTIONS_MAX);
      for (const fallback of stubQaQuestions()) {
        if (questions.length >= QA_QUESTIONS_MIN) break;
        if (!questions.some((q) => q.question === fallback.question)) questions.push(fallback);
      }
      return questions;
    }
    console.error('generateQaQuestions: AI output failed schema validation, falling back to stub');
  } catch (e) {
    console.error('generateQaQuestions: AI call failed, falling back to stub', e);
  }
  return stubQaQuestions();
}

export async function generateReport(
  deps: AiDeps,
  input: {
    challenge: ChallengeContent;
    skillProfile: SkillProfile | null;
    chatHistory: ChatTurn[];
    submissionFiles: { path: string; content: string }[];
    qaPairs: { category: QaCategory; question: string; answer: string }[];
  },
): Promise<string> {
  const { challenge, skillProfile, chatHistory, submissionFiles, qaPairs } = input;
  const fallback = () => stubReport({ textFileCount: submissionFiles.length, qaPairs });
  if (deps.forceStub || !deps.client) return fallback();
  try {
    const raw = await deps.client.complete({
      messages: buildReportMessages(
        challenge,
        skillProfile,
        capHistory(chatHistory),
        buildSubmissionContext(submissionFiles),
        qaPairs,
      ),
      maxCompletionTokens: 8192,
      timeoutMs: AI_TIMEOUT_HEAVY_MS,
    });
    const report = raw.trim();
    return report || fallback();
  } catch (e) {
    console.error('generateReport: AI call failed, falling back to stub', e);
    return fallback();
  }
}

export async function answerReportQuestion(
  deps: AiDeps,
  input: {
    challenge: ChallengeContent;
    reportMd: string;
    quotedText: string | null;
    question: string;
    history: ChatTurn[];
  },
): Promise<string> {
  const { challenge, reportMd, quotedText, question, history } = input;
  if (deps.forceStub || !deps.client) return stubReportAnswer(question, quotedText);
  try {
    const raw = await deps.client.complete({
      messages: buildReportQaMessages(
        challenge,
        reportMd,
        quotedText,
        question,
        capHistory(history),
      ),
      maxCompletionTokens: 2048,
      timeoutMs: AI_TIMEOUT_CHAT_MS,
    });
    const reply = raw.trim();
    return reply || stubReportAnswer(question, quotedText);
  } catch (e) {
    console.error('answerReportQuestion: AI call failed, falling back to stub', e);
    return stubReportAnswer(question, quotedText);
  }
}
