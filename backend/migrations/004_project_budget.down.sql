DROP INDEX IF EXISTS idx_project_expenses_created_by;
DROP INDEX IF EXISTS idx_project_expenses_project_id;

DROP TABLE IF EXISTS project_expenses;

ALTER TABLE projects
    DROP COLUMN IF EXISTS total_budget;
