-- Add editor fields to projects for rich content storage

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS icon_url TEXT,
    ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill deadline from legacy end_date if present
UPDATE projects
SET deadline = end_date
WHERE deadline IS NULL
  AND end_date IS NOT NULL;

-- Keep end_date in sync for existing code paths
UPDATE projects
SET end_date = deadline
WHERE deadline IS NOT NULL
  AND (end_date IS NULL OR end_date <> deadline);
