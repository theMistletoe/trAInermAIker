---
paths:
  - "src/server/services/**"
  - "src/server/routes/**"
  - "src/server/lib/errors.ts"
---

# Server errors & route contract

- **Error class ↔ enum is 1:1.** Each typed error class in `services/*.ts` (e.g. `AttemptNotFoundError`, `InvalidPhaseError`, `InvalidZipError`, `ChatLimitExceededError`) maps to one value in `apiErrorCodeEnum` in `src/shared/schemas.ts`. When adding an error, add the class AND a new enum value together (reuse an existing pair when the semantics match, like report Q&A reusing `CHAT_LIMIT_EXCEEDED`).
- Routes (Hono + `zValidator`) map exceptions → `ApiErrorCode` JSON (see `mapAttemptError` in `routes/attempts.ts`). Handlers end with `c.json(responseSchema.parse(value), status)` — runtime contract guard and the source of the type `hc` infers.
- Routes are chained (`.post().get()`) so `typeof app` retains schema metadata for `hc<AppType>`.
- `notFound` / `onError` are applied as statements **after** `AppType` is captured so their response shapes don't pollute the inferred type. Don't move them before the capture. `onError` maps `HTTPException` with status 400 → `INVALID_BODY` (zValidator throws it on malformed JSON/multipart before its hook runs); everything else → `INTERNAL_ERROR` 500.
- Authorization split: **401 (no session) is decided in routes** (`getSessionUser` guard); **typed domain errors are thrown by services**. There is deliberately no 403 for attempts: another user's attempt surfaces as `AttemptNotFoundError` → 404 — existence itself is hidden. Keep that convention for new user-scoped resources.
- Static paths (`/mine`) must be registered **before** param routes (`/:id`) on the same router.
