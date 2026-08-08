---
paths:
  - "tests/unit/**"
  - "tests/integration/**"
---

# Workers-pool tests (real D1 + R2)

- Run inside `@cloudflare/vitest-pool-workers` against real miniflare bindings: D1 (`env.DB`) **and R2** (`env.SUBMISSIONS` — submission uploads/replacements hit a real local bucket, no mocking). `isolatedStorage: true` resets storage per test **file**, but rows written by earlier tests in the same file are NOT rolled back between tests — depend only on data your own test created (assert on your own attempt's rows, mint unique emails via `uniqueEmail()`).
- AI is stubbed via `AI_STUB: '1'` and email delivery via `EMAIL_STUB: '1'` in `vitest.workers.config.ts` miniflare bindings, and it **MUST stay that way**: they keep every agent role and the signup OTP deterministic and offline, and they must win even when `.dev.vars` leaks real API keys into the pool. The email stub fixes the OTP to `EMAIL_STUB_OTP` (`src/shared/constants.ts`). Real-AI coverage belongs to E2E, not here.
- Import via `cloudflare:test` and the `@server` / `@shared` aliases.
- **No MSW here** — integration tests invoke `app.fetch(req, env)` directly against the real Worker (e.g. `tests/integration/attemptFlow.api.test.ts` walks the full 5-phase machine). Don't introduce client-side mocks in this project.
- Authenticated requests: sign up through the real Better Auth routes with `signUpAndGetCookie()` (`tests/integration/authHelper.ts`) — it completes the email OTP verification with `EMAIL_STUB_OTP` and harvests the cookie from the **verify** response (sign-up itself no longer issues a session). State-changing auth requests need the `origin` header. Zip fixtures come from `tests/fixtures/cdkZip.ts`.
