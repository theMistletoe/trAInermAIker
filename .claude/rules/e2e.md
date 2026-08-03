---
paths:
  - "tests/e2e/**"
---

# E2E tests (Playwright)

- Page Objects live in `tests/e2e/pages/` (`home.page.ts`, `auth.page.ts`, `toast.component.ts`). POMs expose locators and simple actions only; assertions stay in the specs.
- Evidence helpers in `tests/e2e/support/evidence.ts`: `captureStep(page, label)` per `test.step`, `newEvidenceContext(browser)` + `attachContextVideos(ctx, label)` for per-context video.
- Tests rely on stable `data-testid` attributes (`note`, `note-body`, `note-summary`, `note-input`, `note-submit`, `note-summarize-button`, `note-delete-button`, `notes-empty`, `nav-*`, `signup-*`, `login-*`, `my-note-item`, …) — keep these stable when editing components.
- Note bodies / signup emails must be unique per test run (`Date.now()` suffix) — the notes table is shared across tests and runs.
- AI-dependent assertions check presence/non-emptiness only — never exact summary text (real Workers AI vs stub both must pass).
- Run a single test: `npx playwright test tests/e2e/note-flow.spec.ts -g "<title>"`.
