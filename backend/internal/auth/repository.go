package auth

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateUser(ctx context.Context, email, passwordHash string) (User, error) {
	row := r.db.QueryRowContext(
		ctx,
		`INSERT INTO users (email, password_hash) VALUES ($1, $2)
		 RETURNING id, email, password_hash, role, manager_id, created_at`,
		email,
		passwordHash,
	)

	var user User
	err := row.Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Role, &user.ManagerID, &user.CreatedAt)
	return user, err
}

func (r *Repository) GetUserByEmail(ctx context.Context, email string) (User, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT id, email, password_hash, role, manager_id, created_at FROM users WHERE email = $1`,
		email,
	)

	var user User
	err := row.Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Role, &user.ManagerID, &user.CreatedAt)
	return user, err
}

func (r *Repository) GetUserByID(ctx context.Context, id uuid.UUID) (User, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT id, email, password_hash, role, manager_id, created_at FROM users WHERE id = $1`,
		id,
	)

	var user User
	err := row.Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Role, &user.ManagerID, &user.CreatedAt)
	return user, err
}

func (r *Repository) ListUsersByManagerID(ctx context.Context, managerID uuid.UUID) ([]User, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT id, email, password_hash, role, manager_id, created_at FROM users WHERE manager_id = $1`,
		managerID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Role, &user.ManagerID, &user.CreatedAt); err != nil {
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
		`SELECT id, email, password_hash, role, manager_id, created_at FROM users`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Role, &user.ManagerID, &user.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}
