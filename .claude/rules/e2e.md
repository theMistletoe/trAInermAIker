---
paths:
  - "tests/e2e/**"
---

# E2E tests (Playwright)

- Page Objects live in `tests/e2e/pages/` (e.g. `toast.component.ts`). POMs expose locators and simple actions only; assertions stay in the specs.
- Evidence helpers in `tests/e2e/support/evidence.ts`: `captureStep(page, label)` per `test.step`, `newEvidenceContext(browser)` + `attachContextVideos(ctx, label)` for per-context video.
- Tests rely on stable `data-testid` attributes — keep these stable when editing components:
  - challenges: `challenge-card`, `challenge-list-empty`, `challenge-spec`, `challenge-start-button`
  - attempt workspace: `attempt-workspace`, `phase-step-<phase>` (`assessment` / `requirement_chat` / `submission` / `qa` / `report`), `phase-advance-button`
  - assessment: `assessment-form`, `assessment-question`, `assessment-choice-<questionId>-<choiceId>`, `assessment-answer-input`, `assessment-submit`
  - chat: `chat-message`, `chat-input`, `chat-send`, `chat-pending`, `chat-empty`
  - submission: `submission-file-input`, `submission-upload-button`, `submission-file-item`, `submission-file-name`, `submission-file-content`, `submission-file-truncated`, `submission-files-empty`
  - qa: `qa-form`, `qa-question`, `qa-answer-input`, `qa-submit`, `qa-completed`, `qa-generating`, `qa-generate-failed`, `qa-retry-button`
  - report: `report-view`, `report-generating`, `report-generate-failed`, `report-retry-button`, `report-quote`, `report-quote-clear`, `report-ask-button`
  - history（参照パネル）: `history-panel`, `history-section-<key>` / `history-content-<key>` (`challenge` / `assessment` / `chat` / `submission` / `qa`), `history-challenge-description`, `history-assessment-item`, `history-chat-message`, `history-qa-item`, `history-retry-button`
  - nav/auth: `brand-home`, `nav-signup`, `nav-login`, `nav-logout`, `nav-menu`, `nav-menu-panel`, `signup-name`, `signup-email`, `signup-password`, `signup-submit`, `signup-to-login`, `login-email`, `login-password`, `login-submit`, `login-to-signup`
- **Real-AI policy**: E2E runs against real GPT-5.6 when `OPENAI_API_KEY` is available (local: `.dev.vars`; CI: GitHub Secret). Without a key the app's deterministic stub fallback kicks in — specs must pass in both modes.
  - AI-dependent assertions check **presence/non-emptiness only** — never exact AI text.
  - Use generous timeouts: a single AI turn can take 30–90s, so pass explicit `expect(...).toBeVisible({ timeout: ... })` values well above the 5s default. `test.setTimeout(900_000)` is used in the challenge-flow spec **only** — don't spread it to cheap specs. Best-effort fallback clicks must pass a short `{ timeout }` and swallow failures — a bare `.click()` inherits the full test timeout and can eat the whole budget retrying.
  - QA question count is dynamic (3–10): fill every `qa-answer-input` then click `qa-submit` — never hard-code a count.
- Signup emails (and any user-visible content asserted on) must be unique per run (`Date.now()` suffix) — D1 state is shared across tests and runs.
- Run a single test: `npx playwright test tests/e2e/challenge-flow.spec.ts -g "<title>"`.
