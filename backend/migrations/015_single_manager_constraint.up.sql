WITH ranked_managers AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY project_id
               ORDER BY created_at DESC, id DESC
           ) AS rn
    FROM project_members
    WHERE role = 'manager'
)
UPDATE project_members pm
SET role = 'member'
FROM ranked_managers rm
WHERE pm.id = rm.id
  AND rm.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_project_members_single_manager
    ON project_members(project_id, role)
    WHERE role = 'manager';
