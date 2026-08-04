---
paths:
  - "src/shared/schemas.ts"
  - "src/shared/constants.ts"
---

# Shared wire contract

`src/shared/schemas.ts` is the single source of truth for the client/server contract. Every request/response/entity is a Zod schema; the TS types (`Attempt`, `ChallengeDetail`, `ApiErrorCode`, `*Response`, …) derive via `z.infer` / `z.enum` — there is **no codegen step** and no separate `types.ts`.

- Adding an endpoint: add its request + response schemas here first, then write the handler with `zValidator(...)` + `c.json(responseSchema.parse(...), status)` and chain it onto the route. The client gets typed access for free.
- This file breaks three layers together if it drifts: server `AppType` inference, the client `safeParse` guard, and the `tests/mocks/` factories/handlers.
- Challenge secret fields (`hiddenSpecMd`, `rubricMd`, `personaBrief`, `learningPoints`) deliberately have **no schema here** — never add one; that absence is what keeps them off the wire.
- Imports: **server uses relative paths** (`../../shared/...`); client uses the `@shared/*` alias.
- `constants.ts` holds `ASSESSMENT_ANSWER_MAX`, `CHAT_MESSAGE_MAX`, `CHAT_USER_MESSAGES_MAX`, `REPORT_QA_MESSAGES_MAX`, `ZIP_MAX_BYTES`, `QA_QUESTIONS_MIN`/`QA_QUESTIONS_MAX`.
