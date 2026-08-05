import { z } from 'zod';

// One-line swap point for the OpenAI chat model used across all AI roles.
export const DEFAULT_OPENAI_MODEL = 'gpt-5.6';
// Conversational roles must stay responsive; QA/report generation runs inside
// a Workflow step with retries, so the per-attempt budget can be generous.
export const AI_TIMEOUT_CHAT_MS = 30_000;
export const AI_TIMEOUT_HEAVY_MS = 300_000;

export interface ChatCompletionRequest {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  jsonMode?: boolean;
  maxCompletionTokens?: number;
  timeoutMs: number;
}

// Structural seam instead of a vendor SDK type so tests (and any future
// non-OpenAI transport) can inject a plain object.
export interface OpenAiClient {
  complete(req: ChatCompletionRequest): Promise<string>;
}

export interface AiDeps {
  client?: OpenAiClient | undefined;
  // AI_STUB === '1': skip the model even when a key is configured (tests, offline dev).
  forceStub?: boolean;
}

const completionOutputSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().min(1) }) })).min(1),
});

/**
 * OpenAI Chat Completions over REST. A hung API must not pin the request
 * until the Worker's execution limit — the caller picks a timeout per role
 * and everything degrades to the stub on failure.
 */
export function createOpenAiClient(apiKey: string, model: string): OpenAiClient {
  return {
    async complete(req) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: req.messages,
          // NEVER send `temperature`: the gpt-5 family rejects non-default
          // values, and omitting it entirely is the only always-safe option.
          ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}),
          ...(req.maxCompletionTokens !== undefined
            ? { max_completion_tokens: req.maxCompletionTokens }
            : {}),
        }),
        signal: AbortSignal.timeout(req.timeoutMs),
      });
      if (!res.ok) {
        // OpenAI's error body says WHY (bad key, quota, bad model) — surface
        // a snippet so the fallback log is actionable.
        const detail = (await res.text().catch(() => '')).slice(0, 300);
        throw new Error(`OpenAI REST call failed: ${res.status} ${detail}`);
      }
      const parsed = completionOutputSchema.safeParse(await res.json());
      if (!parsed.success) {
        throw new Error('OpenAI response had no message content');
      }
      const content = parsed.data.choices[0]?.message.content;
      if (!content) {
        throw new Error('OpenAI response had no message content');
      }
      return content;
    },
  };
}

/** Resolve AI deps from worker env: stub switch → REST client → stub (empty deps). */
export function aiDepsFromEnv(env: {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  AI_STUB?: string;
}): AiDeps {
  // AI_STUB must win: .dev.vars leaks OPENAI_API_KEY into the vitest pool,
  // and tests rely on the stub being deterministic and offline.
  if (env.AI_STUB === '1') return { forceStub: true };
  if (env.OPENAI_API_KEY) {
    return {
      client: createOpenAiClient(env.OPENAI_API_KEY, env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL),
    };
  }
  return {};
}
