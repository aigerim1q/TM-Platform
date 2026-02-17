CREATE TABLE IF NOT EXISTS hierarchy_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('company', 'department', 'role', 'user')),
    parent_id UUID REFERENCES hierarchy_nodes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    position INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 0,
    path TEXT NOT NULL,
    CONSTRAINT hierarchy_nodes_user_only_for_user_type CHECK (
        (type = 'user' AND user_id IS NOT NULL)
        OR (type <> 'user' AND user_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_hierarchy_nodes_user_id
    ON hierarchy_nodes(user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hierarchy_nodes_parent_position
    ON hierarchy_nodes(parent_id, position, title);

CREATE INDEX IF NOT EXISTS idx_hierarchy_nodes_path
    ON hierarchy_nodes(path);

DO $$
DECLARE
    company_node_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM hierarchy_nodes WHERE type = 'company') THEN
        INSERT INTO hierarchy_nodes (title, type, parent_id, user_id, position, level, path)
        VALUES ('Company', 'company', NULL, NULL, 0, 0, '')
        RETURNING id INTO company_node_id;

        UPDATE hierarchy_nodes
        SET path = company_node_id::TEXT
        WHERE id = company_node_id;
    END IF;
END $$;

DO $$
DECLARE
    company_node_id UUID;
    dep RECORD;
    parent_node_id UUID;
    dep_node_id UUID;
    user_row RECORD;
BEGIN
    SELECT id INTO company_node_id
    FROM hierarchy_nodes
    WHERE type = 'company'
    ORDER BY position ASC, title ASC
    LIMIT 1;

    -- Backfill department nodes.
    FOR dep IN SELECT id, name, parent_id FROM departments ORDER BY name ASC LOOP
        IF EXISTS (SELECT 1 FROM hierarchy_nodes WHERE type = 'department' AND title = dep.name) THEN
            CONTINUE;
        END IF;

        parent_node_id := company_node_id;

        IF dep.parent_id IS NOT NULL THEN
            SELECT id INTO parent_node_id
            FROM hierarchy_nodes
            WHERE type = 'department'
              AND EXISTS (SELECT 1 FROM departments d WHERE d.id = dep.parent_id AND d.name = hierarchy_nodes.title)
            ORDER BY position ASC
            LIMIT 1;

            IF parent_node_id IS NULL THEN
                parent_node_id := company_node_id;
            END IF;
        END IF;

        INSERT INTO hierarchy_nodes (title, type, parent_id, user_id, position, level, path)
        VALUES (dep.name, 'department', parent_node_id, NULL, 0, 0, '')
        RETURNING id INTO dep_node_id;

        UPDATE hierarchy_nodes child
        SET level = parent.level + 1,
            path = parent.path || '.' || child.id::TEXT
        FROM hierarchy_nodes parent
        WHERE child.id = dep_node_id
          AND parent.id = parent_node_id;
    END LOOP;

    -- Backfill user nodes under their department if available, else under company.
    FOR user_row IN
        SELECT u.id, u.full_name, u.email, d.name AS department_name
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
    LOOP
        IF EXISTS (SELECT 1 FROM hierarchy_nodes WHERE user_id = user_row.id) THEN
            CONTINUE;
        END IF;

        parent_node_id := company_node_id;
        IF user_row.department_name IS NOT NULL THEN
            SELECT id INTO parent_node_id
            FROM hierarchy_nodes
            WHERE type = 'department' AND title = user_row.department_name
            ORDER BY position ASC
            LIMIT 1;

            IF parent_node_id IS NULL THEN
                parent_node_id := company_node_id;
            END IF;
        END IF;

        INSERT INTO hierarchy_nodes (title, type, parent_id, user_id, position, level, path)
        VALUES (
            COALESCE(NULLIF(TRIM(user_row.full_name), ''), SPLIT_PART(user_row.email, '@', 1)),
            'user',
            parent_node_id,
            user_row.id,
            0,
            0,
            ''
        )
        RETURNING id INTO dep_node_id;

        UPDATE hierarchy_nodes child
        SET level = parent.level + 1,
            path = parent.path || '.' || child.id::TEXT
        FROM hierarchy_nodes parent
        WHERE child.id = dep_node_id
          AND parent.id = parent_node_id;
    END LOOP;
END $$;
