ALTER TABLE hierarchy_nodes
    DROP CONSTRAINT IF EXISTS hierarchy_nodes_user_for_company_or_user;

UPDATE hierarchy_nodes
SET user_id = NULL
WHERE type = 'company';

ALTER TABLE hierarchy_nodes
    ADD CONSTRAINT hierarchy_nodes_user_only_for_user_type CHECK (
        (type = 'user' AND user_id IS NOT NULL)
        OR (type <> 'user' AND user_id IS NULL)
    );
