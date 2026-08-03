# CLAUDE.md

Path-specific guidance lives in `.claude/rules/*.md` and loads only when you touch matching files (`shared-contract.md`, `server-errors.md`, `migrations.md`, `workers-tests.md`, `client-tests-msw.md`, `e2e.md`, `parallel-review.md`). This file keeps only the always-relevant facts.

## Project Overview

cloudflare-templete is built from an AI-driven development template. The `notes` vertical slice (post + AI summary + ownership) is the **reference implementation**: new features are added by imitating `notes` layer by layer — schemas → migration → db → service → route → tests → UI.

Stack: React 19 + Vite 7 + Tailwind v4 + shadcn/ui (SPA, polling), Hono + Zod on Cloudflare Workers, D1 (SQLite), Better Auth, Workers AI (REST + deterministic stub fallback), Vitest (workers pool + jsdom/MSW), Playwright.

Thanks to `@cloudflare/vite-plugin`, a single `npm run dev` runs the SPA (HMR), the workerd runtime, and the D1 binding in one process — there is no separate API server.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (SPA + workerd + D1) at :5173 |
| `npm run build` | Production build (`dist/client` assets + `dist/cloudflare_templete` worker) |
| `npm run preview` | Preview the production build |
| `npm run deploy` / `deploy:prod` | Build + `wrangler deploy` (**blocked locally by the guard; CI deploys**) |
| `npm run db:migrate:local` | Apply migrations to local D1 |
| `npm run db:migrate:remote` / `db:create:remote` | Production D1 (**never run these; guard blocks them**) |
| `npm run test` / `test:watch` / `test:coverage` | Vitest: workers + client projects |
| `npm run test:e2e` / `test:e2e:evidence` / `test:e2e:report` / `test:e2e:clean` | Playwright E2E / with full evidence / open report / clean artifacts |
| `npm run gen:types` | `wrangler types` → `worker-configuration.d.ts` |
| `npm run typecheck` | `gen:types` then tsc over 4 tsconfigs |
| `npm run lint` / `format` / `check` / `check:fix` | Biome lint / format / check / autofix |

Single test runs: `npx vitest run tests/unit/summarizer.test.ts`, `npx playwright test tests/e2e/note-flow.spec.ts -g "<title>"`.

Pre-commit: simple-git-hooks runs lint-staged (`biome check --write`) on staged files; if it rewrites files, `git add -A` and commit again.

## Architecture

**Server, 4 layers** (`src/server/`): `routes/` (Hono handlers + `zValidator`; the only place exceptions map to `ApiErrorCode` JSON) → `services/` (business logic; throws typed errors like `NoteNotFoundError`, `ForbiddenError`) → `db/` (D1 prepared statements; the only place snake_case rows convert to camelCase domain objects) → `lib/` (`errors.ts`, `summarizer.ts`).

**AI summarization seam** (`src/server/lib/summarizer.ts`): dependency resolution is `AI_STUB=1` → native `env.AI` binding (normally undeclared) → REST (`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_AI_TOKEN`, 15s timeout) → deterministic stub. `wrangler.jsonc` deliberately declares **no `ai` binding**: Workers AI has no local simulation, so a declared binding forces an authenticated remote proxy session at `vite dev`/vitest startup, breaking the unauthenticated dev loop and CI. The summarize flow never fails for AI reasons — everything degrades to the stub. The prompt is a constrained "faithful summary"; keep the constraint structure when adapting it.

**Auth** (Better Auth): owns its own routes (`/api/auth/*`), tables (`user`/`session`/`account`/`verification`), and React client (`better-auth/react`) — it lives **outside** the shared Zod/hc contract and is mounted as a statement after `AppType` is captured. `createAuth(env)` is built **per request** (D1 binding is request-scoped). Ownership IS a domain concern: `notes.owner_id` (nullable) is stamped only when created signed-in; `isOwner` is computed server-side and `owner_id` never hits the wire. Anonymous create/read/summarize works without auth.

**Spec-driven contract**: `src/shared/schemas.ts` is the single source of truth. If it drifts, three layers break together: server `AppType` inference, the client `safeParse` guard (`ApiError(status, 'INVALID_RESPONSE')` on 2xx mismatch), and `tests/mocks/` factories/handlers (all run `.parse()`). Every handler ends with `c.json(responseSchema.parse(value), status)` — a runtime guard and the type source for `hc<AppType>`.

**SPA + Worker coexistence**: with assets configured AND a Worker entrypoint, the Worker is invoked for any unmatched path even under `not_found_handling: "single-page-application"`. `src/server/index.ts`'s `notFound` explicitly delegates non-`/api/*` paths to `c.env.ASSETS.fetch(...)`. **Deleting this breaks SPA deep links.**

**Polling** (`usePollingNotes`): fetches the full list every `VITE_POLL_INTERVAL_MS` (default 500ms) and replaces state wholesale. `inflightRef` skips overlapping ticks; `aliveRef` prevents post-unmount setState. Tests shrink the interval via env (20ms client / 100ms E2E).

## TypeScript: 6 tsconfigs

| Config | Role |
|---|---|
| `tsconfig.json` | Base + `src/shared` (aliases `@shared/*`, `@/*`) |
| `tsconfig.client.json` | Client + DOM libs; includes `src/server` type-only for `AppType` |
| `tsconfig.server.json` | Server + `@cloudflare/workers-types` |
| `tsconfig.shared.json` | Composite build of `src/shared` (declaration output) |
| `tsconfig.test.json` | workers-pool tests (`cloudflare:test` types, `@server/*` alias) |
| `tsconfig.client.test.json` | jsdom tests + mocks |

`npm run typecheck` runs `wrangler types` first — after editing `wrangler.jsonc`, rerun typecheck so `worker-configuration.d.ts` regenerates.

## Testing

Two Vitest projects (`vitest.config.ts` → workers + client) plus Playwright:

- **workers** (`tests/unit/`, `tests/integration/`): real miniflare D1, `app.fetch(req, env)` directly, `AI_STUB=1`. No MSW. Storage is NOT rolled back between tests in the same file — depend only on your own test's data.
- **client** (`tests/client/`): jsdom + MSW (`onUnhandledRequest: 'error'`), mocks only from `tests/mocks/`. Never `vi.mock` the api client.

Details live in the path-scoped rules (`workers-tests.md`, `client-tests-msw.md`, `e2e.md`).

## Conventions

- Biome: single quotes, semicolons, trailing commas, 100-col lines, organized imports. `npm run check:fix` before committing hand-written code.
- Comments explain non-obvious WHY only — no narration of what the next line does.
- Path aliases: client uses `@/*` and `@shared/*`; **server uses relative imports** (`../../shared/...`); workers tests may use `@server/*`/`@shared/*`.
- UI strings live in `src/shared/messages.ts` (`MESSAGES`) — no duplicated literals between components and tests.
- E2E `data-testid` attributes are a contract (see `e2e.md`); keep them stable.

## Deployment

`wrangler.jsonc` is the source of truth (worker name, D1 binding, assets). The D1 `database_id` is a placeholder that works locally; production setup is `npm run db:create:remote` (run manually by a human) → paste the real id. CI: `ci.yml` runs check/typecheck/build/test + Playwright E2E on PRs; `deploy.yml` runs the same verification then remote migrate + `wrangler deploy` on push to main (needs `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secrets and the `production` environment).

## Harness automation

- **Safety**: `settings.json` `permissions.deny` + PreToolUse hook `.claude/hooks/guard.sh` deterministically block production deploys, remote D1 migrations, and force-pushes — including chained/env-prefixed command forms the string-match deny would miss.
- **Verify loop**: the Stop hook `.claude/hooks/verify-stop.sh` runs `check → typecheck → test` at the end of each turn and blocks stopping with logs if anything is red (build is delegated to CI as the slowest, lowest-signal step).
- **Code review**: at implementation milestones, launch the `parallel-reviewer` subagent (see `parallel-review.md` rule), then save the review to `.claude/reviews/` and address Critical items in-session.
