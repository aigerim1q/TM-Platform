ALTER TABLE project_expenses
    ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';

UPDATE project_expenses
SET title = COALESCE(NULLIF(BTRIM(title), ''), NULLIF(BTRIM(description), ''), 'Расход');
