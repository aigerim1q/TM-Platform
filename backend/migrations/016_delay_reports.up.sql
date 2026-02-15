CREATE TABLE IF NOT EXISTS delay_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES project_stages(id) ON DELETE SET NULL,
    task_id UUID REFERENCES stage_tasks(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delay_reports_project_id_created_at_desc
    ON delay_reports(project_id, created_at DESC);
