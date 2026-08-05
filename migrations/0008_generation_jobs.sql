-- Migration 0008: async heavy AI generation status
-- QA question generation and report generation run as Cloudflare Workflows.
-- pending = Workflow in flight; failed = retries exhausted (no stub persisted).

ALTER TABLE attempts ADD COLUMN generation_status TEXT
  CHECK (generation_status IS NULL OR generation_status IN ('pending', 'failed'));

ALTER TABLE attempts ADD COLUMN generation_kind TEXT
  CHECK (generation_kind IS NULL OR generation_kind IN ('qa', 'report'));

ALTER TABLE attempts ADD COLUMN generation_error TEXT;
