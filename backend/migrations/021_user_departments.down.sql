DROP INDEX IF EXISTS idx_users_department_id;
DROP INDEX IF EXISTS idx_departments_parent_id;

ALTER TABLE users
    DROP COLUMN IF EXISTS department_id;

DROP TABLE IF EXISTS departments;
