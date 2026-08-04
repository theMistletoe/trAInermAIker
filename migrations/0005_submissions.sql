-- Migration 0005: submissions
-- One submission per attempt (re-upload replaces). The zip blob lives in R2;
-- extracted text files are stored here for display and AI context.

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY,
  attempt_id INTEGER NOT NULL UNIQUE,
  r2_key TEXT NOT NULL,
  zip_name TEXT NOT NULL,
  zip_size INTEGER NOT NULL,
  entry_count INTEGER NOT NULL,
  text_file_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submission_files (
  id INTEGER PRIMARY KEY,
  submission_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  size INTEGER NOT NULL,
  content TEXT NOT NULL,
  is_truncated INTEGER NOT NULL DEFAULT 0,
  UNIQUE (submission_id, path)
);

CREATE INDEX IF NOT EXISTS idx_submission_files_submission
  ON submission_files (submission_id);
