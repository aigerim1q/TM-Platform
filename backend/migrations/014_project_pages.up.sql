CREATE TABLE IF NOT EXISTS project_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    blocks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_pages_project_id ON project_pages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_pages_created_by ON project_pages(created_by);
