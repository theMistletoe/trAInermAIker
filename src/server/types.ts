export interface Bindings {
  DB: D1Database;
  ASSETS: Fetcher;
  // R2 bucket for submitted challenge deliverables (zip archives).
  SUBMISSIONS: R2Bucket;
  // Durable Workflow for QA / report generation (long OpenAI calls + retries).
  HEAVY_AI_WORKFLOW: Workflow;
  // OpenAI API for the challenge AI agents (assessment / requirement chat /
  // QA generation / report). Absent → deterministic stubs (see lib/ai.ts).
  OPENAI_API_KEY?: string;
  // Overrides the default model id ('gpt-5.6').
  OPENAI_MODEL?: string;
  // Set to '1' to force the deterministic AI stubs even when a key is set
  // (tests, or offline local dev via .dev.vars).
  AI_STUB?: string;
  // Better Auth config. Provided via .dev.vars locally and `wrangler secret` in
  // production; absent in tests (auth.ts falls back to a dev default).
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  // Resend API for signup-verification OTP emails. Absent → the OTP is logged
  // to the console with a fixed stub code (see lib/email.ts); required in
  // production (auth.ts fails loud on a non-local BETTER_AUTH_URL without it).
  RESEND_API_KEY?: string;
  // Overrides the default From address ('onboarding@resend.dev', which only
  // delivers to the Resend account owner's inbox).
  EMAIL_FROM?: string;
  // Set to '1' to force the email stub even when a key is set (tests, or
  // offline local dev via .dev.vars).
  EMAIL_STUB?: string;
}
