ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS total_budget BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS project_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_expenses_project_id ON project_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_created_by ON project_expenses(created_by);
