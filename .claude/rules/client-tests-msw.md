---
paths:
  - "tests/client/**"
  - "tests/mocks/**"
---

# Client tests (jsdom + MSW)

- `tests/mocks/` is the single mock source for jsdom tests. `factories.ts` (`buildAttempt`, `buildChallengeDetail`, `buildSubmission`, `buildQaQuestion`, `buildReport`, …) and `handlers.ts` run results through `*Schema.parse(...)`, so a fixture that drifts from the shared schema fails at construction/response time.
- `tests/client/setup.ts` runs `mswServer.listen({ onUnhandledRequest: 'error' })` — any fetch without a handler **fails the test loudly**. `resetHandlers()` runs in `afterEach`. Use `mswServer.use(http.get(...))` for per-test overrides (404s, malformed bodies, slow handlers).
- **Do NOT `vi.mock('../api/client')`** — it bypasses the Zod `safeParse` layer in `src/client/api/client.ts` and re-introduces the contract-drift blind spot MSW exists to close.
