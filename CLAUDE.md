# CLAUDE.md

Path-specific guidance lives in `.claude/rules/*.md` and loads only when you touch matching files (`shared-contract.md`, `server-errors.md`, `migrations.md`, `workers-tests.md`, `client-tests-msw.md`, `e2e.md`, `parallel-review.md`). This file keeps only the always-relevant facts.

## Project Overview

trAInermAIker is an AI learning app: users work through practical challenges (challenge 1: AWS architecture design with CDK) in a 5-phase flow — skill assessment → requirement-elicitation chat with a deliberately unhelpful stakeholder persona → zip submission → dynamic Q&A → feedback report (with follow-up questions). The `challenges`/`attempts` vertical slice IS the product and the **reference implementation**: new features are added by imitating it layer by layer — schemas → migration → db → service → route → tests → UI.

Stack: React 19 + Vite 7 + Tailwind v4 + shadcn/ui (SPA), Hono + Zod on Cloudflare Workers, D1 (SQLite), R2 (submission zips), Better Auth, OpenAI GPT-5.6 (REST + deterministic stub fallback), Vitest (workers pool + jsdom/MSW), Playwright.

Thanks to `@cloudflare/vite-plugin`, a single `npm run dev` runs the SPA (HMR), the workerd runtime, and the D1/R2 bindings in one process — there is no separate API server.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (SPA + workerd + D1/R2) at :5173 |
| `npm run build` | Production build (`dist/client` assets + worker bundle) |
| `npm run preview` | Preview the production build |
| `npm run deploy` / `deploy:prod` | Build + `wrangler deploy` (**blocked locally by the guard; CI deploys**) |
| `npm run db:migrate:local` | Apply migrations to local D1 |
| `npm run db:migrate:remote` / `db:create:remote` | Production D1 (**never run these; guard blocks them**) |
| `npm run test` / `test:watch` / `test:coverage` | Vitest: workers + client projects |
| `npm run test:e2e` / `test:e2e:evidence` / `test:e2e:report` / `test:e2e:clean` | Playwright E2E / with full evidence / open report / clean artifacts |
| `npm run gen:types` | `wrangler types` → `worker-configuration.d.ts` |
| `npm run typecheck` | `gen:types` then tsc over 5 tsconfigs |
| `npm run lint` / `format` / `check` / `check:fix` | Biome lint / format / check / autofix |

Single test runs: `npx vitest run tests/unit/agent.test.ts`, `npx playwright test tests/e2e/challenge-flow.spec.ts -g "<title>"`.

Pre-commit: simple-git-hooks runs lint-staged (`biome check --write`) on staged files; if it rewrites files, `git add -A` and commit again.

## Architecture

**Server, 4 layers + content** (`src/server/`): `routes/` (`challenges.ts`, `attempts.ts`; Hono handlers + `zValidator`; the only place exceptions map to `ApiErrorCode` JSON) → `services/` (business logic; throws typed errors like `AttemptNotFoundError`, `InvalidPhaseError`) → `db/` (D1 prepared statements; the only place snake_case rows convert to camelCase domain objects) → `lib/` (`ai.ts`, `agent.ts`, `prompts.ts`, `stubs.ts`, `zip.ts`, `errors.ts`), plus `content/` (challenge content, below).

**AI seam** (`src/server/lib/ai.ts` + `agent.ts` + `workflows/heavyAi.ts`): dependency resolution is `AI_STUB=1` → forced stub / `OPENAI_API_KEY` → OpenAI Chat Completions REST (default model `gpt-5.6`, 30s chat / 300s heavy timeouts) / no key → deterministic stub. Interactive roles (assessment, requirement chat, report Q&A) never throw for AI reasons — they degrade to `stubs.ts`. Heavy roles (QA generation, report) run via **Cloudflare Workflows** when a live client exists: failures throw → step retries → `generation_status=failed` (no stub persisted as success). Stub/no-key still inserts deterministic stubs synchronously. JSON roles get one corrective retry; the requirement chat runs `guardVerbatimLeak` against `hiddenSpecMd` + `personaBrief`. Never send `temperature` to the gpt-5 family.

**Challenge content** (`src/server/content/`): challenges live in code, not D1. `ChallengeContent` splits public fields (`id`/`title`/`category`/`summary`/`descriptionMd`/`submissionGuideMd`/`assessmentQuestions`) from secret ones (`hiddenSpecMd`/`rubricMd`/`personaBrief`/`learningPoints`) — secrets feed AI prompts only and have **no response schema on purpose**, so they are structurally unreachable from the wire. Register new challenges in `content/index.ts`; never change a live `id` (attempts reference it).

**Zip pipeline** (`lib/zip.ts` + `submissionService.ts`): fflate `unzipSync` with a central-directory filter that rejects zip bombs before inflation (entry/total-uncompressed caps), path-traversal normalization, `node_modules`/`.git`/`cdk.out`/… exclusion, binary sniffing, and stored-file/char caps. Original zip goes to **R2** (`SUBMISSIONS` binding), extracted text to **D1**; re-upload replaces both. Prompt embedding orders README → `bin/` → `lib/` → rest, capped at 100k chars.

**Phase machine** (`services/attemptService.ts`): `assessment → requirement_chat → submission → qa → report`, one-way. Transitions use a **CAS** update (`updateAttemptPhase` matches the current phase); the loser of a race gets `INVALID_PHASE` (409). Advance guards: `CHAT_REQUIRED` / `SUBMISSION_REQUIRED` / `QA_INCOMPLETE`. If a crash lands between the CAS and the generated insert, `getQaState` / `getReport` **self-heal** by generating the missing questions/report on read. `skillProfile` (set by the assessment) feeds every later AI phase.

**Auth** (Better Auth): owns its own routes (`/api/auth/*`), tables (`user`/`session`/`account`/`verification`), and React client (`better-auth/react`) — it lives **outside** the shared Zod/hc contract and is mounted as a statement after `AppType` is captured. `createAuth(env)` is built **per request** (D1 binding is request-scoped). Challenges list/detail are public; **every `/api/attempts/*` route requires a session** (401 in routes). Other users' attempts surface as 404 (`ATTEMPT_NOT_FOUND`), never 403 — existence is hidden.

**Spec-driven contract**: `src/shared/schemas.ts` is the single source of truth. If it drifts, three layers break together: server `AppType` inference, the client `safeParse` guard (`ApiError(status, 'INVALID_RESPONSE')` on 2xx mismatch), and `tests/mocks/` factories/handlers (all run `.parse()`). Every handler ends with `c.json(responseSchema.parse(value), status)` — a runtime guard and the type source for `hc<AppType>`.

**SPA + Worker coexistence**: with assets configured AND a Worker entrypoint, the Worker is invoked for any unmatched path even under `not_found_handling: "single-page-application"`. `src/server/index.ts`'s `notFound` explicitly delegates non-`/api/*` paths to `c.env.ASSETS.fetch(...)`. **Deleting this breaks SPA deep links.**

## TypeScript: 7 tsconfigs

| Config | Role |
|---|---|
| `tsconfig.json` | Base + `src/shared` (aliases `@shared/*`, `@/*`) |
| `tsconfig.client.json` | Client + DOM libs; includes `src/server` type-only for `AppType` |
| `tsconfig.server.json` | Server + `@cloudflare/workers-types` |
| `tsconfig.shared.json` | Composite build of `src/shared` (declaration output) |
| `tsconfig.test.json` | workers-pool tests (`cloudflare:test` types, `@server/*` alias; excludes `tests/e2e`) |
| `tsconfig.client.test.json` | jsdom tests + mocks |
| `tsconfig.e2e.json` | Playwright specs + fixtures (Node + DOM libs for `page.evaluate`) |

`npm run typecheck` runs `wrangler types` first — after editing `wrangler.jsonc`, rerun typecheck so `worker-configuration.d.ts` regenerates.

## Testing

Two Vitest projects (`vitest.config.ts` → workers + client) plus Playwright:

- **workers** (`tests/unit/`, `tests/integration/`): real miniflare D1 + R2 (`env.SUBMISSIONS`), `app.fetch(req, env)` directly. `AI_STUB=1` is baked into `vitest.workers.config.ts` bindings — deterministic and offline, and it must stay that way. No MSW. Storage is NOT rolled back between tests in the same file — depend only on your own test's data.
- **client** (`tests/client/`): jsdom + MSW (`onUnhandledRequest: 'error'`), mocks only from `tests/mocks/`. Never `vi.mock` the api client.
- **E2E** (`tests/e2e/`): runs against **real GPT-5.6** by policy — local via `.dev.vars` `OPENAI_API_KEY`, CI via the GitHub Secret; keyless environments fall back to the app's stub automatically. AI assertions are presence-only; a full challenge-flow run makes 10–20 model calls and takes 5–15 minutes.

Details live in the path-scoped rules (`workers-tests.md`, `client-tests-msw.md`, `e2e.md`).

## Conventions

- Biome: single quotes, semicolons, trailing commas, 100-col lines, organized imports. `npm run check:fix` before committing hand-written code.
- Comments explain non-obvious WHY only — no narration of what the next line does.
- Path aliases: client uses `@/*` and `@shared/*`; **server uses relative imports** (`../../shared/...`); workers tests may use `@server/*`/`@shared/*`.
- UI strings live in `src/shared/messages.ts` (`MESSAGES`) — no duplicated literals between components and tests.
- E2E `data-testid` attributes are a contract (see `e2e.md`); keep them stable.

## Deployment

`wrangler.jsonc` is the source of truth (worker name, D1 binding, R2 `SUBMISSIONS` binding, assets). No `ai` binding: the AI agents call OpenAI over REST. The D1 `database_id` is the real production id (provisioned once via `npm run db:create:remote`, run manually by a human; inert locally). CI: `ci.yml` runs check/typecheck/build/test + Playwright E2E on PRs (real-AI E2E when the `OPENAI_API_KEY` secret is set); `deploy.yml` re-runs check/typecheck/build/vitest (E2E gates only PRs), then ensures the R2 bucket (`r2 bucket info || create` — the API token needs "Workers R2 Storage: Edit"), remote-migrates D1, runs `wrangler deploy`, and smoke-checks `/` + `/api/challenges` when the `PRODUCTION_URL` repo variable is set. Needs `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/`OPENAI_API_KEY` secrets and the `production` environment; worker secrets `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`/`OPENAI_API_KEY` are set via `wrangler secret put`.

## Harness automation

- **Safety**: `settings.json` `permissions.deny` + PreToolUse hook `.claude/hooks/guard.sh` deterministically block production deploys, remote D1 migrations, and force-pushes — including chained/env-prefixed command forms the string-match deny would miss.
- **Verify loop**: the Stop hook `.claude/hooks/verify-stop.sh` runs `check → typecheck → test` at the end of each turn and blocks stopping with logs if anything is red (build is delegated to CI as the slowest, lowest-signal step).
- **Code review**: at implementation milestones, launch the `parallel-reviewer` subagent (see `parallel-review.md` rule), then save the review to `.claude/reviews/` and address Critical items in-session.
