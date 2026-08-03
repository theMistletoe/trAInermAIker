-- Migration 0001: notes
-- summary is filled in later by the AI summarizer (nullable until then).

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY,
  body TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_created_at
  ON notes (created_at);
