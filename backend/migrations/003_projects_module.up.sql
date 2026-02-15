DO $$
BEGIN
    CREATE TYPE project_status AS ENUM ('active', 'completed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE projects
    RENAME COLUMN name TO title;

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS cover_url TEXT,
    ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status project_status NOT NULL DEFAULT 'active';
