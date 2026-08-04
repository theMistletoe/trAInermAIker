---
paths:
  - "tests/unit/**"
  - "tests/integration/**"
---

# Workers-pool tests (real D1 + R2)

- Run inside `@cloudflare/vitest-pool-workers` against real miniflare bindings: D1 (`env.DB`) **and R2** (`env.SUBMISSIONS` — submission uploads/replacements hit a real local bucket, no mocking). `isolatedStorage: true` resets storage per test **file**, but rows written by earlier tests in the same file are NOT rolled back between tests — depend only on data your own test created (assert on your own attempt's rows, mint unique emails via `uniqueEmail()`).
- AI is stubbed via `AI_STUB: '1'` in `vitest.workers.config.ts` miniflare bindings, and it **MUST stay that way**: it keeps every agent role deterministic and offline, and it must win even when `.dev.vars` leaks a real `OPENAI_API_KEY` into the pool. Real-AI coverage belongs to E2E, not here.
- Import via `cloudflare:test` and the `@server` / `@shared` aliases.
- **No MSW here** — integration tests invoke `app.fetch(req, env)` directly against the real Worker (e.g. `tests/integration/attemptFlow.api.test.ts` walks the full 5-phase machine). Don't introduce client-side mocks in this project.
- Authenticated requests: sign up through the real Better Auth routes with `signUpAndGetCookie()` (`tests/integration/authHelper.ts`) — state-changing auth requests need the `origin` header. Zip fixtures come from `tests/fixtures/cdkZip.ts`.
