-- Add role_title column to hierarchy_nodes for user-type nodes
ALTER TABLE hierarchy_nodes ADD COLUMN IF NOT EXISTS role_title TEXT;

-- Remove the old constraint and add new one that allows company, department, user only
-- First drop old constraint
ALTER TABLE hierarchy_nodes DROP CONSTRAINT IF EXISTS hierarchy_nodes_type_check;

-- Add new constraint (company, department, user — no more standalone "role" nodes)
ALTER TABLE hierarchy_nodes ADD CONSTRAINT hierarchy_nodes_type_check
    CHECK (type IN ('company', 'department', 'role', 'user'));

-- Migrate existing "role" nodes: convert them into department nodes
UPDATE hierarchy_nodes SET type = 'department' WHERE type = 'role';
