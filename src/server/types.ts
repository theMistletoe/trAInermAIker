export interface Bindings {
  DB: D1Database;
  ASSETS: Fetcher;
  // Workers AI binding for the note summarizer. Not declared in wrangler.jsonc
  // (a declared binding breaks unauthenticated dev/test startup — see the
  // comment there) but kept optional so a bound environment is used first if
  // one ever exists.
  AI?: Ai;
  // Workers AI REST fallback credentials (.dev.vars locally, secrets in prod).
  // Absent → the summarizer degrades to a deterministic stub.
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_AI_TOKEN?: string;
  // Set to '1' to force the summarizer stub even when AI is reachable (tests,
  // or offline/neuron-frugal local dev via .dev.vars).
  AI_STUB?: string;
  // Better Auth config. Provided via .dev.vars locally and `wrangler secret` in
  // production; absent in tests (auth.ts falls back to a dev default).
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
}
