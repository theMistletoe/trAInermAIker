import { z } from 'zod';

// One-line swap point for the summarization model. llama-3.3-70b (fp8-fast) is
// the best-JP model a free-tier account can run — gemma-3-12b-it is gated (REST
// error 5018 "not allowed to access this model") on free-tier accounts.
export const SUMMARIZE_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

// Structural seam instead of the full workers-types `Ai` interface so tests
// (and any future non-binding transport) can inject a plain object.
export interface AiClient {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

export interface SummarizerDeps {
  ai?: AiClient | undefined;
  // AI_STUB === '1': skip the model even when bound (tests, offline dev).
  forceStub?: boolean;
}

/**
 * Workers AI over REST. Used instead of a native `ai` binding because a
 * declared binding forces an authenticated remote proxy session at dev/test
 * startup (see wrangler.jsonc). The REST envelope is { result, success, ... };
 * `run` unwraps it to match the binding's return shape.
 */
export function createRestAiClient(accountId: string, apiToken: string): AiClient {
  return {
    async run(model, inputs) {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(inputs),
          // A hung AI API must not pin the request until the Worker's execution
          // limit — time out and let the caller fall back to the stub.
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!res.ok) {
        // Cloudflare's error body says WHY (bad token, missing permission,
        // wrong account) — surface a snippet so the fallback log is actionable.
        const detail = (await res.text().catch(() => '')).slice(0, 300);
        throw new Error(`Workers AI REST call failed: ${res.status} ${detail}`);
      }
      const envelope = (await res.json()) as {
        success?: boolean;
        result?: unknown;
        errors?: { message?: string }[];
      };
      if (!envelope.success) {
        // Model-level failures arrive as HTTP 200 + success:false — keep the
        // first error message so this path is as diagnosable as the non-2xx one.
        throw new Error(
          `Workers AI REST call returned success=false: ${envelope.errors?.[0]?.message ?? ''}`,
        );
      }
      return envelope.result;
    },
  };
}

/** Resolve summarizer deps from worker env: stub switch → native binding → REST → stub. */
export function summarizerDepsFromEnv(env: {
  AI?: AiClient;
  AI_STUB?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_AI_TOKEN?: string;
}): SummarizerDeps {
  if (env.AI_STUB === '1') return { forceStub: true };
  if (env.AI) return { ai: env.AI };
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_AI_TOKEN) {
    return { ai: createRestAiClient(env.CLOUDFLARE_ACCOUNT_ID, env.CLOUDFLARE_AI_TOKEN) };
  }
  return {};
}

const STUB_MAX_CHARS = 500;

/**
 * Deterministic no-AI summary: collapse whitespace and truncate. Used for
 * tests/CI and as the fallback whenever the real model is unavailable or
 * misbehaves — the summarize flow must never fail because summarization did.
 */
export function stubSummarize(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length <= STUB_MAX_CHARS ? collapsed : `${collapsed.slice(0, STUB_MAX_CHARS)}…`;
}

// Workers AI text-generation output comes in two shapes depending on the
// model: legacy { response } or OpenAI-compatible { choices[0].message.content }
// (what current llama/mistral/gpt-oss models return over REST, verified live).
// Anything else routes to the stub instead of throwing.
const legacyOutputSchema = z.object({ response: z.string().min(1) });
const chatOutputSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().min(1) }) })).min(1),
});

function extractAiText(raw: unknown): string | null {
  const legacy = legacyOutputSchema.safeParse(raw);
  if (legacy.success) return legacy.data.response;
  const chat = chatOutputSchema.safeParse(raw);
  if (chat.success) return chat.data.choices[0]?.message.content ?? null;
  return null;
}

/**
 * Faithful summary of the input text. The prompt constrains the model to the
 * source text as the sole source: no outside knowledge, no invented causality,
 * hedges/conditions/negations preserved, undecidable spots marked
 * 「［原文不明瞭］」 rather than guessed. An unconstrained "summarize this"
 * prompt tends to invent content the author never wrote — these rules exist to
 * prevent that. Keep them when adapting the prompt to your domain.
 */
export async function summarizeText(deps: SummarizerDeps, text: string): Promise<string> {
  if (deps.forceStub || !deps.ai) return stubSummarize(text);
  try {
    const raw = await deps.ai.run(SUMMARIZE_MODEL, {
      messages: [
        {
          role: 'system',
          content: [
            'あなたは、入力された日本語テキストを編集する「忠実な要約担当」です。',
            '',
            '入力テキストだけを情報源として、書かれている内容を、読みやすく、誤解の生じにくい要約文に変換してください。',
            '',
            '次のルールを厳守してください。',
            '',
            '* 冗長な言い回しや、言い直しによる無意味な繰り返しは削除する',
            '* 明らかな誤字脱字や、文法的に破綻している箇所は、前後の文脈から正しい内容を一意に判断できる場合に限り、意味を変えない最小限の範囲で修正する',
            '* 主要な主張、理由、結論、具体例、条件、例外、留保を整理し、重複や本筋に関係しない部分を省いて簡潔にまとめる',
            '* 話題ごとに文章を整理し、適切な句読点と段落を補って読みやすくする',
            '* 記述の順序は、意味や論理関係が変わらない範囲でのみ整理する',
            '* 筆者が誰かの意見や事例を紹介している場合は、それを筆者自身の意見として書かない',
            '* 推測、補足説明、外部知識、一般論、評価、感想、新しい結論を追加しない',
            '* 原文に存在しない因果関係や意図を生成しない',
            '* 可能性、予測、希望、推測として書かれた内容を、確定事項として断定しない',
            '* 否定表現、条件、例外、不確実性、程度を示す表現は、要約後も正確に保持する',
            '* 人名、企業名、サービス名、日付、数値、金額、割合、単位などは、原文にある内容を正確に維持する',
            '* 内容に矛盾がある場合は、勝手に正しい内容を選んだり矛盾を解消したりしない',
            '* 事実として誤っているように見える記述でも、外部知識を使って訂正しない',
            '* 文脈から意味を確定できない箇所は推測して補わない。要約に不可欠で、かつ判別できない場合のみ「［原文不明瞭］」と記載する',
            '* 要約によって重要な前提やニュアンスが失われ、元の記述より強い主張や異なる意味にならないよう注意する',
            '* 原文に複数の解釈があり得る場合は、一つの解釈に決めつけず、原文と同程度の曖昧さを維持する',
            '',
            '整形後の要約本文のみを出力してください。前置き、説明、タイトル、注釈、編集方針、原文との比較は出力しないでください。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: text,
        },
      ],
      // A faithful summary can still approach input length when the source is
      // dense — leave enough room that long inputs don't truncate mid-sentence.
      max_tokens: 2048,
      // Faithful summarization wants near-greedy decoding.
      temperature: 0,
    });
    const out = extractAiText(raw);
    return out?.trim() || stubSummarize(text);
  } catch (e) {
    console.error('summarizeText: AI call failed, falling back to stub', e);
    return stubSummarize(text);
  }
}
