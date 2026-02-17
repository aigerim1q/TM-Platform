-- Revert: remove role_title column
ALTER TABLE hierarchy_nodes DROP COLUMN IF EXISTS role_title;

-- Restore original type constraint
ALTER TABLE hierarchy_nodes DROP CONSTRAINT IF EXISTS hierarchy_nodes_type_check;
ALTER TABLE hierarchy_nodes ADD CONSTRAINT hierarchy_nodes_type_check
    CHECK (type IN ('company', 'department', 'role', 'user'));
