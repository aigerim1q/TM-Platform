-- Add real status column to hierarchy_nodes
ALTER TABLE hierarchy_nodes ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'free';

-- Set sensible defaults: users = free, departments/company = active
UPDATE hierarchy_nodes SET status = 'free' WHERE type = 'user';
UPDATE hierarchy_nodes SET status = 'active' WHERE type != 'user';
