package projects

import (
	"context"
	"database/sql"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, ownerID, name, description string) (Project, error) {
	row := r.db.QueryRowContext(
		ctx,
		`INSERT INTO projects (owner_id, name, description)
		 VALUES ($1, $2, $3)
		 RETURNING id, owner_id, name, description, created_at`,
		ownerID,
		name,
		description,
	)

	var project Project
	err := row.Scan(&project.ID, &project.OwnerID, &project.Name, &project.Description, &project.CreatedAt)
	return project, err
}

func (r *Repository) ListByOwner(ctx context.Context, ownerID string) ([]Project, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT id, owner_id, name, description, created_at
		 FROM projects
		 WHERE owner_id = $1
		 ORDER BY created_at DESC`,
		ownerID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var project Project
		if err := rows.Scan(&project.ID, &project.OwnerID, &project.Name, &project.Description, &project.CreatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}

	return projects, rows.Err()
}
