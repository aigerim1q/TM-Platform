ALTER TABLE stage_tasks
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE stage_tasks
SET updated_at = now()
WHERE updated_at IS NULL;
