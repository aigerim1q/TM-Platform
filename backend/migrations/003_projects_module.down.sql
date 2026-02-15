ALTER TABLE projects
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS end_date,
    DROP COLUMN IF EXISTS start_date,
    DROP COLUMN IF EXISTS cover_url;

ALTER TABLE projects
    RENAME COLUMN title TO name;

DROP TYPE IF EXISTS project_status;
