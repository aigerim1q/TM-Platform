package hierarchy

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type Repository struct {
	db *sql.DB
}

type dbNode struct {
	ID        uuid.UUID
	Title     string
	Type      NodeType
	ParentID  *uuid.UUID
	UserID    *uuid.UUID
	Position  int
	Level     int
	Path      string
	Status    string
	RoleTitle sql.NullString

	UserEmail     sql.NullString
	UserFullName  sql.NullString
	UserAvatarURL sql.NullString
	UserRole      sql.NullString
	UserManagerID *uuid.UUID
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ListNodes(ctx context.Context) ([]dbNode, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			n.id,
			n.title,
			n.type,
			n.parent_id,
			n.user_id,
			n.position,
			n.level,
			n.path,
			n.status,
			n.role_title,
			u.email,
			u.full_name,
			u.avatar_url,
			u.role,
			u.manager_id
		FROM hierarchy_nodes n
		LEFT JOIN users u ON u.id = n.user_id
		ORDER BY n.level ASC, n.path ASC, n.position ASC, n.title ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]dbNode, 0)
	for rows.Next() {
		var item dbNode
		if err := rows.Scan(
			&item.ID,
			&item.Title,
			&item.Type,
			&item.ParentID,
			&item.UserID,
			&item.Position,
			&item.Level,
			&item.Path,
			&item.Status,
			&item.RoleTitle,
			&item.UserEmail,
			&item.UserFullName,
			&item.UserAvatarURL,
			&item.UserRole,
			&item.UserManagerID,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

func (r *Repository) GetNodeByID(ctx context.Context, id uuid.UUID) (dbNode, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT
			n.id,
			n.title,
			n.type,
			n.parent_id,
			n.user_id,
			n.position,
			n.level,
			n.path,
			n.status,
			n.role_title,
			u.email,
			u.full_name,
			u.avatar_url,
			u.role,
			u.manager_id
		FROM hierarchy_nodes n
		LEFT JOIN users u ON u.id = n.user_id
		WHERE n.id = $1`, id)

	var item dbNode
	err := row.Scan(
		&item.ID,
		&item.Title,
		&item.Type,
		&item.ParentID,
		&item.UserID,
		&item.Position,
		&item.Level,
		&item.Path,
		&item.Status,
		&item.RoleTitle,
		&item.UserEmail,
		&item.UserFullName,
		&item.UserAvatarURL,
		&item.UserRole,
		&item.UserManagerID,
	)
	return item, err
}

func (r *Repository) CreateNode(ctx context.Context, input createNodeInput) (dbNode, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return dbNode{}, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	level := 0
	pathPrefix := ""
	if input.ParentID != nil {
		var parentLevel int
		var parentType NodeType
		if scanErr := tx.QueryRowContext(ctx, `SELECT level, path, type FROM hierarchy_nodes WHERE id = $1`, *input.ParentID).Scan(&parentLevel, &pathPrefix, &parentType); scanErr != nil {
			err = scanErr
			return dbNode{}, err
		}
		if parentType == NodeTypeUser {
			err = errors.New("cannot create child nodes under user node")
			return dbNode{}, err
		}
		level = parentLevel + 1
	}

	position := 0
	if input.Position != nil {
		position = *input.Position
	}

	var id uuid.UUID
	insertErr := tx.QueryRowContext(ctx, `
		INSERT INTO hierarchy_nodes (title, type, parent_id, user_id, position, level, path)
		VALUES ($1, $2, $3, NULL, $4, $5, '')
		RETURNING id`, input.Title, input.Type, input.ParentID, position, level).Scan(&id)
	if insertErr != nil {
		err = insertErr
		return dbNode{}, err
	}

	newPath := id.String()
	if pathPrefix != "" {
		newPath = pathPrefix + "." + id.String()
	}

	if _, updateErr := tx.ExecContext(ctx, `UPDATE hierarchy_nodes SET path = $2 WHERE id = $1`, id, newPath); updateErr != nil {
		err = updateErr
		return dbNode{}, err
	}

	if input.Type == NodeTypeDepartment {
		if _, catalogErr := ensureDepartmentCatalogEntryTx(ctx, tx, input.Title); catalogErr != nil {
			err = catalogErr
			return dbNode{}, err
		}
	}

	if commitErr := tx.Commit(); commitErr != nil {
		err = commitErr
		return dbNode{}, err
	}

	return r.GetNodeByID(ctx, id)
}

func (r *Repository) UpdateNode(ctx context.Context, id uuid.UUID, input updateNodeInput) (dbNode, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return dbNode{}, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	var currentTitle string
	var currentType NodeType
	var currentParentID *uuid.UUID
	var currentPosition int
	var currentLevel int
	var currentPath string
	if scanErr := tx.QueryRowContext(ctx, `SELECT title, type, parent_id, position, level, path FROM hierarchy_nodes WHERE id = $1`, id).Scan(
		&currentTitle,
		&currentType,
		&currentParentID,
		&currentPosition,
		&currentLevel,
		&currentPath,
	); scanErr != nil {
		err = scanErr
		return dbNode{}, err
	}

	newTitle := currentTitle
	if input.Title != nil {
		newTitle = strings.TrimSpace(*input.Title)
	}

	newPosition := currentPosition
	if input.Position != nil {
		newPosition = *input.Position
	}

	newParentID := currentParentID
	if input.ParentSet {
		newParentID = input.ParentID
	}

	newLevel := currentLevel
	newPath := currentPath
	if !uuidPtrEqual(currentParentID, newParentID) {
		parentPath := ""
		parentLevel := -1
		if newParentID != nil {
			if scanErr := tx.QueryRowContext(ctx, `SELECT path, level FROM hierarchy_nodes WHERE id = $1`, *newParentID).Scan(&parentPath, &parentLevel); scanErr != nil {
				err = scanErr
				return dbNode{}, err
			}

			if parentPath == currentPath || strings.HasPrefix(parentPath, currentPath+".") {
				err = errors.New("cannot move node into its own subtree")
				return dbNode{}, err
			}
		}

		newLevel = parentLevel + 1
		if newParentID == nil {
			newPath = id.String()
		} else {
			newPath = parentPath + "." + id.String()
		}
	}

	// Handle role_title update
	var newRoleTitle sql.NullString
	if input.RoleSet {
		if input.RoleTitle != nil && strings.TrimSpace(*input.RoleTitle) != "" {
			newRoleTitle = sql.NullString{String: strings.TrimSpace(*input.RoleTitle), Valid: true}
			if _, catalogErr := ensureRoleCatalogEntryTx(ctx, tx, newRoleTitle.String); catalogErr != nil {
				err = catalogErr
				return dbNode{}, err
			}
		}
		if _, execErr := tx.ExecContext(ctx, `UPDATE hierarchy_nodes SET role_title = $2 WHERE id = $1`, id, newRoleTitle); execErr != nil {
			err = execErr
			return dbNode{}, err
		}
	}

	if currentType == NodeTypeDepartment && input.Title != nil {
		if _, catalogErr := ensureDepartmentCatalogEntryTx(ctx, tx, newTitle); catalogErr != nil {
			err = catalogErr
			return dbNode{}, err
		}
	}

	if _, execErr := tx.ExecContext(ctx, `
		UPDATE hierarchy_nodes
		SET title = $2,
			parent_id = $3,
			position = $4,
			level = $5,
			path = $6
		WHERE id = $1`, id, newTitle, newParentID, newPosition, newLevel, newPath); execErr != nil {
		err = execErr
		return dbNode{}, err
	}

	if currentPath != newPath || currentLevel != newLevel {
		if _, execErr := tx.ExecContext(ctx, `
			UPDATE hierarchy_nodes
			SET level = $3 + (level - $4),
				path = $2 || SUBSTRING(path FROM LENGTH($1) + 1)
			WHERE path LIKE $1 || '.%'`, currentPath, newPath, newLevel, currentLevel); execErr != nil {
			err = execErr
			return dbNode{}, err
		}
	}

	if commitErr := tx.Commit(); commitErr != nil {
		err = commitErr
		return dbNode{}, err
	}

	return r.GetNodeByID(ctx, id)
}

func (r *Repository) AssignUserToNode(ctx context.Context, parentNodeID, userID uuid.UUID) (dbNode, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return dbNode{}, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	var parentType NodeType
	var parentLevel int
	var parentPath string
	if scanErr := tx.QueryRowContext(ctx, `SELECT type, level, path FROM hierarchy_nodes WHERE id = $1`, parentNodeID).Scan(&parentType, &parentLevel, &parentPath); scanErr != nil {
		err = scanErr
		return dbNode{}, err
	}
	if parentType == NodeTypeUser {
		err = errors.New("user cannot be assigned under a user node")
		return dbNode{}, err
	}

	if parentType == NodeTypeCompany {
		var previousCompanyUserID *uuid.UUID
		if prevScanErr := tx.QueryRowContext(ctx, `SELECT user_id FROM hierarchy_nodes WHERE id = $1`, parentNodeID).Scan(&previousCompanyUserID); prevScanErr != nil {
			err = prevScanErr
			return dbNode{}, err
		}

		var existingNodeID uuid.UUID
		lookupErr := tx.QueryRowContext(ctx, `SELECT id FROM hierarchy_nodes WHERE user_id = $1`, userID).Scan(&existingNodeID)
		if lookupErr != nil && !errors.Is(lookupErr, sql.ErrNoRows) {
			err = lookupErr
			return dbNode{}, err
		}

		if lookupErr == nil && existingNodeID != parentNodeID {
			if _, execErr := tx.ExecContext(ctx, `DELETE FROM hierarchy_nodes WHERE id = $1`, existingNodeID); execErr != nil {
				err = execErr
				return dbNode{}, err
			}
		}

		if _, execErr := tx.ExecContext(ctx, `UPDATE hierarchy_nodes SET user_id = $2 WHERE id = $1`, parentNodeID, userID); execErr != nil {
			err = execErr
			return dbNode{}, err
		}

		if _, execErr := tx.ExecContext(ctx, `UPDATE users SET manager_id = NULL, department_id = NULL, role = 'ceo' WHERE id = $1`, userID); execErr != nil {
			err = execErr
			return dbNode{}, err
		}

		if previousCompanyUserID != nil && *previousCompanyUserID != userID {
			if _, execErr := tx.ExecContext(ctx, `
				UPDATE users
				SET role = CASE
					WHEN LOWER(COALESCE(role, '')) = 'ceo' THEN NULL
					ELSE role
				END
				WHERE id = $1`, *previousCompanyUserID); execErr != nil {
				err = execErr
				return dbNode{}, err
			}
		}

		if commitErr := tx.Commit(); commitErr != nil {
			err = commitErr
			return dbNode{}, err
		}

		return r.GetNodeByID(ctx, parentNodeID)
	}

	var email string
	var fullName sql.NullString
	if scanErr := tx.QueryRowContext(ctx, `SELECT email, full_name FROM users WHERE id = $1`, userID).Scan(&email, &fullName); scanErr != nil {
		err = scanErr
		return dbNode{}, err
	}

	title := strings.TrimSpace(fullName.String)
	if title == "" {
		title = strings.TrimSpace(strings.Split(email, "@")[0])
	}
	if title == "" {
		title = "User"
	}

	position := 0
	if scanErr := tx.QueryRowContext(ctx, `SELECT COALESCE(MAX(position), -1) + 1 FROM hierarchy_nodes WHERE parent_id = $1`, parentNodeID).Scan(&position); scanErr != nil {
		err = scanErr
		return dbNode{}, err
	}

	var existingNodeID uuid.UUID
	lookupErr := tx.QueryRowContext(ctx, `SELECT id FROM hierarchy_nodes WHERE user_id = $1`, userID).Scan(&existingNodeID)
	if lookupErr != nil && !errors.Is(lookupErr, sql.ErrNoRows) {
		err = lookupErr
		return dbNode{}, err
	}
	if lookupErr == nil {
		var existingType NodeType
		if scanErr := tx.QueryRowContext(ctx, `SELECT type FROM hierarchy_nodes WHERE id = $1`, existingNodeID).Scan(&existingType); scanErr != nil {
			err = scanErr
			return dbNode{}, err
		}

		if existingType == NodeTypeCompany && parentType != NodeTypeCompany {
			if _, execErr := tx.ExecContext(ctx, `UPDATE hierarchy_nodes SET user_id = NULL WHERE id = $1`, existingNodeID); execErr != nil {
				err = execErr
				return dbNode{}, err
			}
			lookupErr = sql.ErrNoRows
		}
	}

	var resultNodeID uuid.UUID
	if errors.Is(lookupErr, sql.ErrNoRows) {
		insertErr := tx.QueryRowContext(ctx, `
			INSERT INTO hierarchy_nodes (title, type, parent_id, user_id, position, level, path)
			VALUES ($1, 'user', $2, $3, $4, $5, '')
			RETURNING id`,
			title,
			parentNodeID,
			userID,
			position,
			parentLevel+1,
		).Scan(&resultNodeID)
		if insertErr != nil {
			err = insertErr
			return dbNode{}, err
		}

		newPath := fmt.Sprintf("%s.%s", parentPath, resultNodeID.String())
		if _, execErr := tx.ExecContext(ctx, `UPDATE hierarchy_nodes SET path = $2 WHERE id = $1`, resultNodeID, newPath); execErr != nil {
			err = execErr
			return dbNode{}, err
		}
	} else {
		resultNodeID = existingNodeID
		var oldPath string
		var oldLevel int
		if scanErr := tx.QueryRowContext(ctx, `SELECT path, level FROM hierarchy_nodes WHERE id = $1`, existingNodeID).Scan(&oldPath, &oldLevel); scanErr != nil {
			err = scanErr
			return dbNode{}, err
		}

		newPath := fmt.Sprintf("%s.%s", parentPath, existingNodeID.String())
		if _, execErr := tx.ExecContext(ctx, `
			UPDATE hierarchy_nodes
			SET title = $2,
				parent_id = $3,
				position = $4,
				level = $5,
				path = $6
			WHERE id = $1`, existingNodeID, title, parentNodeID, position, parentLevel+1, newPath); execErr != nil {
			err = execErr
			return dbNode{}, err
		}

		if oldPath != newPath || oldLevel != parentLevel+1 {
			if _, execErr := tx.ExecContext(ctx, `
				UPDATE hierarchy_nodes
				SET level = $3 + (level - $4),
					path = $2 || SUBSTRING(path FROM LENGTH($1) + 1)
				WHERE path LIKE $1 || '.%'`, oldPath, newPath, parentLevel+1, oldLevel); execErr != nil {
				err = execErr
				return dbNode{}, err
			}
		}
	}

	managerID, resolveManagerErr := resolveNearestManagerIDTx(ctx, tx, parentPath)
	if resolveManagerErr != nil {
		err = resolveManagerErr
		return dbNode{}, err
	}

	departmentID, resolveDepartmentErr := resolveNearestDepartmentIDTx(ctx, tx, parentPath)
	if resolveDepartmentErr != nil {
		err = resolveDepartmentErr
		return dbNode{}, err
	}

	departmentTitle, resolveDepartmentTitleErr := resolveNearestDepartmentTitleTx(ctx, tx, parentPath)
	if resolveDepartmentTitleErr != nil {
		err = resolveDepartmentTitleErr
		return dbNode{}, err
	}

	autoRole := inferAutoSystemRole(parentType, departmentTitle)

	if _, execErr := tx.ExecContext(ctx, `
		UPDATE users
		SET manager_id = $2,
			department_id = $3,
			role = CASE
				WHEN $4::text <> '' THEN $4
				WHEN LOWER(COALESCE(role, '')) IN ('ceo', 'hr') THEN NULL
				ELSE role
			END
		WHERE id = $1`, userID, managerID, departmentID, autoRole); execErr != nil {
		err = execErr
		return dbNode{}, err
	}

	if commitErr := tx.Commit(); commitErr != nil {
		err = commitErr
		return dbNode{}, err
	}

	return r.GetNodeByID(ctx, resultNodeID)
}

func (r *Repository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE hierarchy_nodes SET status = $2 WHERE id = $1`, id, status)
	return err
}

func (r *Repository) GetNodeUserID(ctx context.Context, id uuid.UUID) (*uuid.UUID, error) {
	var userID *uuid.UUID
	err := r.db.QueryRowContext(ctx, `SELECT user_id FROM hierarchy_nodes WHERE id = $1`, id).Scan(&userID)
	return userID, err
}

func (r *Repository) DeleteNode(ctx context.Context, id uuid.UUID) error {
	var nodeType NodeType
	if err := r.db.QueryRowContext(ctx, `SELECT type FROM hierarchy_nodes WHERE id = $1`, id).Scan(&nodeType); err != nil {
		return err
	}
	if nodeType == NodeTypeCompany {
		return errors.New("cannot delete company root node")
	}
	// ON DELETE CASCADE handles children
	_, err := r.db.ExecContext(ctx, `DELETE FROM hierarchy_nodes WHERE id = $1`, id)
	return err
}

func (r *Repository) ListDepartmentCatalog(ctx context.Context) ([]CatalogItem, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, is_system
		FROM hierarchy_department_catalog
		ORDER BY is_system DESC, name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]CatalogItem, 0)
	for rows.Next() {
		var item CatalogItem
		if scanErr := rows.Scan(&item.ID, &item.Name, &item.IsSystem); scanErr != nil {
			return nil, scanErr
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *Repository) ListRoleCatalog(ctx context.Context) ([]CatalogItem, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, is_system
		FROM hierarchy_role_catalog
		ORDER BY is_system DESC, name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]CatalogItem, 0)
	for rows.Next() {
		var item CatalogItem
		if scanErr := rows.Scan(&item.ID, &item.Name, &item.IsSystem); scanErr != nil {
			return nil, scanErr
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func ensureDepartmentCatalogEntryTx(ctx context.Context, tx *sql.Tx, title string) (*uuid.UUID, error) {
	normalized := normalizeCatalogName(title)
	if normalized == "" {
		return nil, nil
	}

	var id uuid.UUID
	if err := tx.QueryRowContext(ctx, `
		INSERT INTO hierarchy_department_catalog (name, is_system)
		VALUES ($1, false)
		ON CONFLICT (name)
		DO UPDATE SET name = EXCLUDED.name
		RETURNING id`, normalized).Scan(&id); err != nil {
		return nil, err
	}
	return &id, nil
}

func ensureRoleCatalogEntryTx(ctx context.Context, tx *sql.Tx, title string) (*uuid.UUID, error) {
	normalized := normalizeCatalogName(title)
	if normalized == "" {
		return nil, nil
	}

	var id uuid.UUID
	if err := tx.QueryRowContext(ctx, `
		INSERT INTO hierarchy_role_catalog (name, is_system)
		VALUES ($1, false)
		ON CONFLICT (name)
		DO UPDATE SET name = EXCLUDED.name
		RETURNING id`, normalized).Scan(&id); err != nil {
		return nil, err
	}
	return &id, nil
}

func ensureDepartmentIDByNameTx(ctx context.Context, tx *sql.Tx, title string) (*uuid.UUID, error) {
	normalized := normalizeCatalogName(title)
	if normalized == "" {
		return nil, nil
	}

	var id uuid.UUID
	if err := tx.QueryRowContext(ctx, `
		SELECT id
		FROM departments
		WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
		ORDER BY id ASC
		LIMIT 1`, normalized).Scan(&id); err == nil {
		return &id, nil
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	if err := tx.QueryRowContext(ctx, `
		INSERT INTO departments (name)
		VALUES ($1)
		RETURNING id`, normalized).Scan(&id); err != nil {
		return nil, err
	}

	return &id, nil
}

func resolveNearestManagerIDTx(ctx context.Context, tx *sql.Tx, parentPath string) (*uuid.UUID, error) {
	if strings.TrimSpace(parentPath) == "" {
		return nil, nil
	}

	var managerID *uuid.UUID
	err := tx.QueryRowContext(ctx, `
		SELECT user_id
		FROM hierarchy_nodes
		WHERE user_id IS NOT NULL
		  AND ($1 = path OR $1 LIKE path || '.%')
		ORDER BY level DESC
		LIMIT 1`, parentPath).Scan(&managerID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return managerID, nil
}

func resolveNearestDepartmentIDTx(ctx context.Context, tx *sql.Tx, parentPath string) (*uuid.UUID, error) {
	if strings.TrimSpace(parentPath) == "" {
		return nil, nil
	}

	var departmentTitle string
	err := tx.QueryRowContext(ctx, `
		SELECT title
		FROM hierarchy_nodes
		WHERE type = 'department'
		  AND ($1 = path OR $1 LIKE path || '.%')
		ORDER BY level DESC
		LIMIT 1`, parentPath).Scan(&departmentTitle)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return ensureDepartmentIDByNameTx(ctx, tx, departmentTitle)
}

func resolveNearestDepartmentTitleTx(ctx context.Context, tx *sql.Tx, parentPath string) (string, error) {
	if strings.TrimSpace(parentPath) == "" {
		return "", nil
	}

	var departmentTitle string
	err := tx.QueryRowContext(ctx, `
		SELECT title
		FROM hierarchy_nodes
		WHERE type = 'department'
		  AND ($1 = path OR $1 LIKE path || '.%')
		ORDER BY level DESC
		LIMIT 1`, parentPath).Scan(&departmentTitle)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", nil
		}
		return "", err
	}

	return strings.TrimSpace(departmentTitle), nil
}

func inferAutoSystemRole(parentType NodeType, departmentTitle string) string {
	if parentType == NodeTypeCompany {
		return "ceo"
	}

	normalized := strings.ToLower(strings.TrimSpace(departmentTitle))
	if normalized == "" {
		return ""
	}

	if strings.Contains(normalized, "hr") || strings.Contains(normalized, "кадр") || strings.Contains(normalized, "human resources") {
		return "hr"
	}

	return ""
}

func normalizeCatalogName(value string) string {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return ""
	}
	return strings.Join(strings.Fields(normalized), " ")
}

func uuidPtrEqual(a, b *uuid.UUID) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}
