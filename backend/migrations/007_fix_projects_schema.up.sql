-- Fix drifted projects schema (older DB may still have column `name` instead of `title`).

DO $$
BEGIN
    -- If `name` exists and `title` does not, rename.
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'projects'
          AND column_name = 'name'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'projects'
          AND column_name = 'title'
    ) THEN
        ALTER TABLE projects RENAME COLUMN name TO title;
    END IF;
END $$;

DO $$
BEGIN
    CREATE TYPE project_status AS ENUM ('active', 'completed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS cover_url TEXT,
    ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status project_status NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS total_budget BIGINT NOT NULL DEFAULT 0;
