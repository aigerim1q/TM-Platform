CREATE TABLE IF NOT EXISTS report_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES stage_tasks(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_chat_messages_project_id_created_at
    ON report_chat_messages(project_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_report_chat_messages_task_id_created_at
    ON report_chat_messages(task_id, created_at ASC);

CREATE TABLE IF NOT EXISTS delay_report_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES delay_reports(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES delay_report_comments(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delay_report_comments_report_created_at
    ON delay_report_comments(report_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_delay_report_comments_parent_id
    ON delay_report_comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_delay_report_comments_project_id
    ON delay_report_comments(project_id);
