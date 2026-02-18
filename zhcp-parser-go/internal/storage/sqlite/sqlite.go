package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"zhcp-parser-go/internal/storage"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

type SQLiteStorage struct {
	db *sql.DB
}

func New(dbPath string) *SQLiteStorage {
	return &SQLiteStorage{}
}

func (s *SQLiteStorage) Init(ctx context.Context) error {
	db, err := sql.Open("sqlite3", "zhcp.db")
	if err != nil {
		return err
	}
	s.db = db

	// Create tables
	schema := `
	CREATE TABLE IF NOT EXISTS projects (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		description TEXT,
		location TEXT,
		start_date DATETIME,
		end_date DATETIME,
		budget REAL,
		status TEXT NOT NULL DEFAULT 'planned',
		metadata TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS tasks (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL,
		title TEXT NOT NULL,
		description TEXT,
		status TEXT NOT NULL DEFAULT 'pending',
		priority TEXT,
		assigned_to TEXT,
		start_date DATETIME,
		due_date DATETIME,
		completed_at DATETIME,
		dependencies TEXT,
		metadata TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
	CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
	CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
	`

	_, err = s.db.ExecContext(ctx, schema)
	return err
}

func (s *SQLiteStorage) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

// ============================================================================
// Project Operations
// ============================================================================

func (s *SQLiteStorage) SaveProject(ctx context.Context, project *storage.Project) error {
	if project.ID == "" {
		project.ID = uuid.New().String()
	}
	if project.CreatedAt.IsZero() {
		project.CreatedAt = time.Now()
	}
	project.UpdatedAt = time.Now()

	metadataJSON, _ := json.Marshal(project.Metadata)

	query := `
		INSERT INTO projects (id, title, description, location, start_date, end_date, budget, status, metadata, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.ExecContext(ctx, query,
		project.ID, project.Title, project.Description, project.Location,
		project.StartDate, project.EndDate, project.Budget, project.Status,
		string(metadataJSON), project.CreatedAt, project.UpdatedAt,
	)
	return err
}

func (s *SQLiteStorage) GetProject(ctx context.Context, id string) (*storage.Project, error) {
	query := `
		SELECT id, title, description, location, start_date, end_date, budget, status, metadata, created_at, updated_at
		FROM projects WHERE id = ?
	`

	var project storage.Project
	var metadataJSON sql.NullString
	var startDate, endDate sql.NullTime

	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&project.ID, &project.Title, &project.Description, &project.Location,
		&startDate, &endDate, &project.Budget, &project.Status,
		&metadataJSON, &project.CreatedAt, &project.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, storage.ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if startDate.Valid {
		project.StartDate = &startDate.Time
	}
	if endDate.Valid {
		project.EndDate = &endDate.Time
	}
	if metadataJSON.Valid {
		json.Unmarshal([]byte(metadataJSON.String), &project.Metadata)
	}

	return &project, nil
}

func (s *SQLiteStorage) ListProjects(ctx context.Context) ([]*storage.Project, error) {
	query := `
		SELECT id, title, description, location, start_date, end_date, budget, status, metadata, created_at, updated_at
		FROM projects ORDER BY created_at DESC
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []*storage.Project
	for rows.Next() {
		var project storage.Project
		var metadataJSON sql.NullString
		var startDate, endDate sql.NullTime

		err := rows.Scan(
			&project.ID, &project.Title, &project.Description, &project.Location,
			&startDate, &endDate, &project.Budget, &project.Status,
			&metadataJSON, &project.CreatedAt, &project.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if startDate.Valid {
			project.StartDate = &startDate.Time
		}
		if endDate.Valid {
			project.EndDate = &endDate.Time
		}
		if metadataJSON.Valid {
			json.Unmarshal([]byte(metadataJSON.String), &project.Metadata)
		}

		projects = append(projects, &project)
	}

	return projects, rows.Err()
}

func (s *SQLiteStorage) UpdateProject(ctx context.Context, project *storage.Project) error {
	project.UpdatedAt = time.Now()
	metadataJSON, _ := json.Marshal(project.Metadata)

	query := `
		UPDATE projects 
		SET title = ?, description = ?, location = ?, start_date = ?, end_date = ?, 
		    budget = ?, status = ?, metadata = ?, updated_at = ?
		WHERE id = ?
	`

	result, err := s.db.ExecContext(ctx, query,
		project.Title, project.Description, project.Location,
		project.StartDate, project.EndDate, project.Budget, project.Status,
		string(metadataJSON), project.UpdatedAt, project.ID,
	)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return storage.ErrNotFound
	}

	return nil
}

func (s *SQLiteStorage) DeleteProject(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, "DELETE FROM projects WHERE id = ?", id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return storage.ErrNotFound
	}

	return nil
}

// ============================================================================
// Task Operations
// ============================================================================

func (s *SQLiteStorage) SaveTask(ctx context.Context, task *storage.Task) error {
	if task.ID == "" {
		task.ID = uuid.New().String()
	}
	if task.CreatedAt.IsZero() {
		task.CreatedAt = time.Now()
	}
	task.UpdatedAt = time.Now()

	metadataJSON, _ := json.Marshal(task.Metadata)
	dependenciesJSON, _ := json.Marshal(task.Dependencies)

	query := `
		INSERT INTO tasks (id, project_id, title, description, status, priority, assigned_to, 
		                   start_date, due_date, completed_at, dependencies, metadata, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.ExecContext(ctx, query,
		task.ID, task.ProjectID, task.Title, task.Description, task.Status, task.Priority,
		task.AssignedTo, task.StartDate, task.DueDate, task.CompletedAt,
		string(dependenciesJSON), string(metadataJSON), task.CreatedAt, task.UpdatedAt,
	)
	return err
}

func (s *SQLiteStorage) GetTask(ctx context.Context, id string) (*storage.Task, error) {
	query := `
		SELECT id, project_id, title, description, status, priority, assigned_to,
		       start_date, due_date, completed_at, dependencies, metadata, created_at, updated_at
		FROM tasks WHERE id = ?
	`

	var task storage.Task
	var metadataJSON, dependenciesJSON sql.NullString
	var startDate, dueDate, completedAt sql.NullTime

	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&task.ID, &task.ProjectID, &task.Title, &task.Description, &task.Status,
		&task.Priority, &task.AssignedTo, &startDate, &dueDate, &completedAt,
		&dependenciesJSON, &metadataJSON, &task.CreatedAt, &task.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, storage.ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if startDate.Valid {
		task.StartDate = &startDate.Time
	}
	if dueDate.Valid {
		task.DueDate = &dueDate.Time
	}
	if completedAt.Valid {
		task.CompletedAt = &completedAt.Time
	}
	if metadataJSON.Valid {
		json.Unmarshal([]byte(metadataJSON.String), &task.Metadata)
	}
	if dependenciesJSON.Valid {
		json.Unmarshal([]byte(dependenciesJSON.String), &task.Dependencies)
	}

	return &task, nil
}

func (s *SQLiteStorage) ListTasks(ctx context.Context, projectID string) ([]*storage.Task, error) {
	query := `
		SELECT id, project_id, title, description, status, priority, assigned_to,
		       start_date, due_date, completed_at, dependencies, metadata, created_at, updated_at
		FROM tasks WHERE project_id = ? ORDER BY created_at DESC
	`

	rows, err := s.db.QueryContext(ctx, query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*storage.Task
	for rows.Next() {
		var task storage.Task
		var metadataJSON, dependenciesJSON sql.NullString
		var startDate, dueDate, completedAt sql.NullTime

		err := rows.Scan(
			&task.ID, &task.ProjectID, &task.Title, &task.Description, &task.Status,
			&task.Priority, &task.AssignedTo, &startDate, &dueDate, &completedAt,
			&dependenciesJSON, &metadataJSON, &task.CreatedAt, &task.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if startDate.Valid {
			task.StartDate = &startDate.Time
		}
		if dueDate.Valid {
			task.DueDate = &dueDate.Time
		}
		if completedAt.Valid {
			task.CompletedAt = &completedAt.Time
		}
		if metadataJSON.Valid {
			json.Unmarshal([]byte(metadataJSON.String), &task.Metadata)
		}
		if dependenciesJSON.Valid {
			json.Unmarshal([]byte(dependenciesJSON.String), &task.Dependencies)
		}

		tasks = append(tasks, &task)
	}

	return tasks, rows.Err()
}

func (s *SQLiteStorage) UpdateTask(ctx context.Context, task *storage.Task) error {
	task.UpdatedAt = time.Now()
	metadataJSON, _ := json.Marshal(task.Metadata)
	dependenciesJSON, _ := json.Marshal(task.Dependencies)

	query := `
		UPDATE tasks 
		SET title = ?, description = ?, status = ?, priority = ?, assigned_to = ?,
		    start_date = ?, due_date = ?, completed_at = ?, dependencies = ?, metadata = ?, updated_at = ?
		WHERE id = ?
	`

	result, err := s.db.ExecContext(ctx, query,
		task.Title, task.Description, task.Status, task.Priority, task.AssignedTo,
		task.StartDate, task.DueDate, task.CompletedAt,
		string(dependenciesJSON), string(metadataJSON), task.UpdatedAt, task.ID,
	)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return storage.ErrNotFound
	}

	return nil
}

func (s *SQLiteStorage) UpdateTaskStatus(ctx context.Context, id, status string) error {
	var completedAt *time.Time
	if status == "completed" {
		now := time.Now()
		completedAt = &now
	}

	query := `UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?`
	result, err := s.db.ExecContext(ctx, query, status, completedAt, time.Now(), id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return storage.ErrNotFound
	}

	return nil
}

func (s *SQLiteStorage) DeleteTask(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, "DELETE FROM tasks WHERE id = ?", id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return storage.ErrNotFound
	}

	return nil
}
