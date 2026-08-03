---
paths:
  - "migrations/**"
---

# D1 migrations

- Append a new file `migrations/00NN_<description>.sql` with a zero-padded sequential number (current max is `0003`).
- Apply locally with `npm run db:migrate:local` only. **Never** run `db:migrate:remote` / `db:create:remote` — they hit production D1 and are blocked by the PreToolUse guard.
- Tests pick up new migrations automatically via `readD1Migrations` (`tests/integration/setup.ts` calls `applyD1Migrations` before all tests).
- Never edit an applied migration file; always append a new one.
