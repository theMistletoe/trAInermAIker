---
paths:
  - "src/server/services/**"
  - "src/server/routes/**"
  - "src/server/lib/errors.ts"
---

# Server errors & route contract

- **Error class ↔ enum is 1:1.** Each typed error class in `services/*.ts` (e.g. `NoteNotFoundError`, `ForbiddenError`) maps to one value in `apiErrorCodeEnum` in `src/shared/schemas.ts`. When adding an error, add the class AND a new enum value together.
- Routes (Hono + `zValidator`) map exceptions → `ApiErrorCode` JSON. Handlers end with `c.json(responseSchema.parse(value), status)` — runtime contract guard and the source of the type `hc` infers.
- Routes are chained (`.post().get()`) so `typeof app` retains schema metadata for `hc<AppType>`.
- `notFound` / `onError` are applied as statements **after** `AppType` is captured so their response shapes don't pollute the inferred type. Don't move them before the capture.
- Authorization split: **401 (no session) is decided in routes; 403 (not the owner) is thrown by services** (`ForbiddenError`). Keep that split when adding owner-only endpoints.
- Static paths (`/mine`) must be registered **before** param routes (`/:id`) on the same router.
