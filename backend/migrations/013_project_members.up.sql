CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT project_members_role_check CHECK (role IN ('owner', 'manager', 'member'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_project_members_project_user
    ON project_members(project_id, user_id);

CREATE INDEX IF NOT EXISTS idx_project_members_user
    ON project_members(user_id);

INSERT INTO project_members (project_id, user_id, role)
SELECT p.id, p.owner_id, 'owner'
FROM projects p
WHERE p.owner_id IS NOT NULL
ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner';
