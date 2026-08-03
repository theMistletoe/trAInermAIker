-- Note ownership. owner_id is the Better Auth user.id of the creator when the
-- note was created while signed in; NULL for anonymous notes (which remain
-- fully supported). Loosely coupled by design: no hard FK to Better Auth's
-- "user" table so this migration stays independent of the library-managed auth
-- schema.
ALTER TABLE notes ADD COLUMN owner_id TEXT;

CREATE INDEX idx_notes_owner ON notes (owner_id);
