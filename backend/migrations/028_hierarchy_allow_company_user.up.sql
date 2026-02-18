ALTER TABLE hierarchy_nodes
    DROP CONSTRAINT IF EXISTS hierarchy_nodes_user_only_for_user_type;

ALTER TABLE hierarchy_nodes
    DROP CONSTRAINT IF EXISTS hierarchy_nodes_user_for_company_or_user;

ALTER TABLE hierarchy_nodes
    ADD CONSTRAINT hierarchy_nodes_user_for_company_or_user CHECK (
        (type = 'user' AND user_id IS NOT NULL)
        OR (type = 'company')
        OR (type NOT IN ('user', 'company') AND user_id IS NULL)
    );
