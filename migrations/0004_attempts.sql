-- Migration 0004: attempts
-- Challenge attempts (phase state machine), assessment answers, and the
-- requirement-chat message log. user_id references Better Auth's user.id
-- without a FK (loose coupling to the library-managed schema, like notes).

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'assessment'
    CHECK (phase IN ('assessment', 'requirement_chat', 'submission', 'qa', 'report')),
  skill_profile_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attempts_user_challenge
  ON attempts (user_id, challenge_id);

CREATE TABLE IF NOT EXISTS assessment_answers (
  id INTEGER PRIMARY KEY,
  attempt_id INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  answer_value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_answers_attempt
  ON assessment_answers (attempt_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY,
  attempt_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_attempt
  ON chat_messages (attempt_id, id);
