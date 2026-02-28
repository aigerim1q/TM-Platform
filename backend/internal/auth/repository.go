package auth

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
)

type Repository struct {
	db *sql.DB
}

type userScanner interface {
	Scan(dest ...any) error
}

var ErrRefreshTokenNotFound = errors.New("refresh token not found")
var ErrRefreshTokenInvalid = errors.New("refresh token invalid")

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateUser(ctx context.Context, email, passwordHash string, fullName *string) (User, error) {
	row := r.db.QueryRowContext(
		ctx,
		`INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3)
		 RETURNING id, full_name, avatar_url, email, password_hash, role, manager_id, department_id, NULL::TEXT AS department_name, created_at`,
		email,
		passwordHash,
		fullName,
	)

	var user User
	err := scanUser(row, &user)
	return user, err
}

func (r *Repository) GetUserByEmail(ctx context.Context, email string) (User, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT u.id, u.full_name, u.avatar_url, u.email, u.password_hash, u.role, u.manager_id, u.department_id, d.name, u.created_at
		 FROM users u
		 LEFT JOIN departments d ON d.id = u.department_id
		 WHERE u.email = $1`,
		email,
	)

	var user User
	err := scanUser(row, &user)
	return user, err
}

func (r *Repository) GetUserByID(ctx context.Context, id uuid.UUID) (User, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT u.id, u.full_name, u.avatar_url, u.email, u.password_hash, u.role, u.manager_id, u.department_id, d.name, u.created_at
		 FROM users u
		 LEFT JOIN departments d ON d.id = u.department_id
		 WHERE u.id = $1`,
		id,
	)

	var user User
	err := scanUser(row, &user)
	return user, err
}

func (r *Repository) ListUsersByManagerID(ctx context.Context, managerID uuid.UUID) ([]User, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT u.id, u.full_name, u.avatar_url, u.email, u.password_hash, u.role, u.manager_id, u.department_id, d.name, u.created_at
		 FROM users u
		 LEFT JOIN departments d ON d.id = u.department_id
		 WHERE u.manager_id = $1`,
		managerID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		if err := scanUser(rows, &user); err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}

func (r *Repository) ListUsers(ctx context.Context) ([]User, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT u.id, u.full_name, u.avatar_url, u.email, u.password_hash, u.role, u.manager_id, u.department_id, d.name, u.created_at
		 FROM users u
		 LEFT JOIN departments d ON d.id = u.department_id`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		if err := scanUser(rows, &user); err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}

func (r *Repository) GetDepartmentByID(ctx context.Context, id uuid.UUID) (Department, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT id, name, parent_id, created_at FROM departments WHERE id = $1`,
		id,
	)

	var department Department
	err := row.Scan(&department.ID, &department.Name, &department.ParentID, &department.CreatedAt)
	return department, err
}

func (r *Repository) ListDepartments(ctx context.Context) ([]Department, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT id, name, parent_id, created_at
		 FROM departments
		 ORDER BY name ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var departments []Department
	for rows.Next() {
		var department Department
		if err := rows.Scan(&department.ID, &department.Name, &department.ParentID, &department.CreatedAt); err != nil {
			return nil, err
		}
		departments = append(departments, department)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return departments, nil
}

func (r *Repository) CreateDepartment(ctx context.Context, name string, parentID *uuid.UUID) (Department, error) {
	row := r.db.QueryRowContext(
		ctx,
		`INSERT INTO departments (name, parent_id)
		 VALUES ($1, $2)
		 RETURNING id, name, parent_id, created_at`,
		name,
		parentID,
	)

	var department Department
	err := row.Scan(&department.ID, &department.Name, &department.ParentID, &department.CreatedAt)
	return department, err
}

func (r *Repository) UpdateUserHierarchy(ctx context.Context, userID uuid.UUID, role *string, managerID, departmentID *uuid.UUID) (User, error) {
	row := r.db.QueryRowContext(
		ctx,
		`WITH updated AS (
			UPDATE users
			SET role = $2,
			    manager_id = $3,
			    department_id = $4
			WHERE id = $1
			RETURNING id, full_name, avatar_url, email, password_hash, role, manager_id, department_id, created_at
		)
		SELECT u.id, u.full_name, u.avatar_url, u.email, u.password_hash, u.role, u.manager_id, u.department_id, d.name, u.created_at
		FROM updated u
		LEFT JOIN departments d ON d.id = u.department_id`,
		userID,
		role,
		managerID,
		departmentID,
	)

	var user User
	err := scanUser(row, &user)
	return user, err
}

func (r *Repository) UpdateUserProfile(ctx context.Context, userID uuid.UUID, email string, fullName, avatarURL *string) (User, error) {
	row := r.db.QueryRowContext(
		ctx,
		`WITH updated AS (
			UPDATE users
			SET email = $2,
			    full_name = $3,
			    avatar_url = $4
			WHERE id = $1
			RETURNING id, full_name, avatar_url, email, password_hash, role, manager_id, department_id, created_at
		)
		SELECT u.id, u.full_name, u.avatar_url, u.email, u.password_hash, u.role, u.manager_id, u.department_id, d.name, u.created_at
		FROM updated u
		LEFT JOIN departments d ON d.id = u.department_id`,
		userID,
		email,
		fullName,
		avatarURL,
	)

	var user User
	err := scanUser(row, &user)
	return user, err
}

func scanUser(scanner userScanner, user *User) error {
	return scanner.Scan(
		&user.ID,
		&user.FullName,
		&user.AvatarURL,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.ManagerID,
		&user.DepartmentID,
		&user.DepartmentName,
		&user.CreatedAt,
	)
}

func (r *Repository) StoreRefreshToken(ctx context.Context, userID uuid.UUID, jti, tokenHash string, expiresAt time.Time) error {
	_, err := r.db.ExecContext(
		ctx,
		`INSERT INTO auth_refresh_tokens (user_id, jti, token_hash, expires_at)
		 VALUES ($1, $2, $3, $4)`,
		userID,
		jti,
		tokenHash,
		expiresAt.UTC(),
	)
	return err
}

func (r *Repository) ConsumeAndRotateRefreshToken(
	ctx context.Context,
	tokenHash string,
	expectedJTI string,
	newJTI string,
	newHash string,
	newExpiresAt time.Time,
) (uuid.UUID, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback()

	var current RefreshTokenRecord
	var revokedAt sql.NullTime
	var replacedBy sql.NullString
	err = tx.QueryRowContext(
		ctx,
		`SELECT id, user_id, jti, token_hash, expires_at, revoked_at, replaced_by, created_at
		 FROM auth_refresh_tokens
		 WHERE token_hash = $1
		 FOR UPDATE`,
		tokenHash,
	).Scan(
		&current.ID,
		&current.UserID,
		&current.JTI,
		&current.TokenHash,
		&current.ExpiresAt,
		&revokedAt,
		&replacedBy,
		&current.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return uuid.Nil, ErrRefreshTokenNotFound
		}
		return uuid.Nil, err
	}
	if revokedAt.Valid {
		revokedCopy := revokedAt.Time
		current.RevokedAt = &revokedCopy
	}
	if replacedBy.Valid {
		parsed, parseErr := uuid.Parse(replacedBy.String)
		if parseErr == nil {
			current.ReplacedBy = &parsed
		}
	}

	now := time.Now().UTC()
	if current.JTI != expectedJTI || current.ExpiresAt.Before(now) || current.RevokedAt != nil || current.ReplacedBy != nil {
		return uuid.Nil, ErrRefreshTokenInvalid
	}

	var nextID uuid.UUID
	err = tx.QueryRowContext(
		ctx,
		`INSERT INTO auth_refresh_tokens (user_id, jti, token_hash, expires_at)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		current.UserID,
		newJTI,
		newHash,
		newExpiresAt.UTC(),
	).Scan(&nextID)
	if err != nil {
		return uuid.Nil, err
	}

	if _, err := tx.ExecContext(
		ctx,
		`UPDATE auth_refresh_tokens
		 SET revoked_at = $2, replaced_by = $3
		 WHERE id = $1`,
		current.ID,
		now,
		nextID,
	); err != nil {
		return uuid.Nil, err
	}

	if err := tx.Commit(); err != nil {
		return uuid.Nil, err
	}

	return current.UserID, nil
}
