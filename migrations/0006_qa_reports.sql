-- Migration 0006: qa and reports
-- QA questions are generated once at the submission->qa transition; answers
-- fill in one by one. The report is generated once at the qa->report
-- transition; report_messages holds the follow-up Q&A thread.

CREATE TABLE IF NOT EXISTS qa_questions (
  id INTEGER PRIMARY KEY,
  attempt_id INTEGER NOT NULL,
  question_no INTEGER NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('gap', 'unasked_requirement', 'learning_point', 'growth')),
  question TEXT NOT NULL,
  answer TEXT,
  answered_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (attempt_id, question_no)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  attempt_id INTEGER NOT NULL UNIQUE,
  content_md TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS report_messages (
  id INTEGER PRIMARY KEY,
  attempt_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  quoted_text TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_messages_attempt
  ON report_messages (attempt_id, id);
