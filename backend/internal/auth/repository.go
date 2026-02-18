package auth

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
)

type Repository struct {
	db *sql.DB
}

type userScanner interface {
	Scan(dest ...any) error
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateUser(ctx context.Context, email, passwordHash string) (User, error) {
	row := r.db.QueryRowContext(
		ctx,
		`INSERT INTO users (email, password_hash) VALUES ($1, $2)
		 RETURNING id, NULL::TEXT AS full_name, NULL::TEXT AS avatar_url, email, password_hash, role, manager_id, department_id, NULL::TEXT AS department_name, created_at`,
		email,
		passwordHash,
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

func (r *Repository) UpdateUserProfile(ctx context.Context, userID uuid.UUID, email string, fullName *string, avatarURL *string) (User, error) {
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
