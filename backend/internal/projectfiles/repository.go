package projectfiles

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

func (r *Repository) Create(ctx context.Context, ownerID uuid.UUID, input CreateProjectFileInput) (ProjectFile, error) {
	row := r.db.QueryRowContext(
		ctx,
		`INSERT INTO project_files (project_id, url, type, name, size)
		 SELECT p.id, $2, $3, $4, $5
		 FROM projects p
		 WHERE p.id = $1 AND p.owner_id = $6
		 RETURNING id, project_id, url, type, name, size, created_at`,
		input.ProjectID,
		input.URL,
		input.Type,
		input.Name,
		input.Size,
		ownerID,
	)

	var file ProjectFile
	if err := row.Scan(
		&file.ID,
		&file.ProjectID,
		&file.URL,
		&file.Type,
		&file.Name,
		&file.Size,
		&file.CreatedAt,
	); err != nil {
		return ProjectFile{}, err
	}

	return file, nil
}

func (r *Repository) ListDocumentsByOwner(ctx context.Context, ownerID uuid.UUID) ([]Document, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT pf.id, pf.project_id, p.title, pf.url, pf.type, pf.name, pf.size, pf.created_at
		 FROM project_files pf
		 JOIN projects p ON p.id = pf.project_id
		 WHERE p.owner_id = $1
		 ORDER BY pf.created_at DESC`,
		ownerID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	documents := make([]Document, 0)
	for rows.Next() {
		var doc Document
		if err := rows.Scan(
			&doc.ID,
			&doc.ProjectID,
			&doc.ProjectName,
			&doc.URL,
			&doc.Type,
			&doc.Name,
			&doc.Size,
			&doc.CreatedAt,
		); err != nil {
			return nil, err
		}
		doc.Status = "new"
		documents = append(documents, doc)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return documents, nil
}
