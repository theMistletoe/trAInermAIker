---
paths:
  - "tests/unit/**"
  - "tests/integration/**"
---

# Workers-pool tests (real D1)

- Run inside `@cloudflare/vitest-pool-workers` against a real miniflare D1. `isolatedStorage: true` resets D1 per test **file**, but rows written by earlier tests in the same file are NOT rolled back between tests — depend only on data your own test created (assert on list heads, mint unique emails via `uniqueEmail()`).
- Import via `cloudflare:test` and the `@server` / `@shared` aliases.
- **No MSW here** — integration tests invoke `app.fetch(req, env)` directly against the real Worker. Don't introduce client-side mocks in this project.
- Authenticated requests: sign up through the real Better Auth routes with `signUpAndGetCookie()` (`tests/integration/authHelper.ts`) — state-changing auth requests need the `origin` header.
