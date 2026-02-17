package storage

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound = errors.New("not found")
)

// Storage interface defines methods for data persistence
type Storage interface {
	Init(ctx context.Context) error
	Close() error

	// Project operations
	SaveProject(ctx context.Context, project *Project) error
	GetProject(ctx context.Context, id string) (*Project, error)
	ListProjects(ctx context.Context) ([]*Project, error)
	UpdateProject(ctx context.Context, project *Project) error
	DeleteProject(ctx context.Context, id string) error

	// Task operations
	SaveTask(ctx context.Context, task *Task) error
	GetTask(ctx context.Context, id string) (*Task, error)
	ListTasks(ctx context.Context, projectID string) ([]*Task, error)
	UpdateTask(ctx context.Context, task *Task) error
	UpdateTaskStatus(ctx context.Context, id, status string) error
	DeleteTask(ctx context.Context, id string) error
}

// Project represents a construction project
type Project struct {
	ID          string                 `json:"id"`
	Title       string                 `json:"title"`
	Description string                 `json:"description,omitempty"`
	Location    string                 `json:"location,omitempty"`
	StartDate   *time.Time             `json:"start_date,omitempty"`
	EndDate     *time.Time             `json:"end_date,omitempty"`
	Budget      float64                `json:"budget,omitempty"`
	Status      string                 `json:"status"` // planned, in_progress, completed, on_hold
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// Task represents a project task
type Task struct {
	ID          string                 `json:"id"`
	ProjectID   string                 `json:"project_id"`
	Title       string                 `json:"title"`
	Description string                 `json:"description,omitempty"`
	Status      string                 `json:"status"` // pending, in_progress, completed, blocked
	Priority    string                 `json:"priority,omitempty"` // low, medium, high, urgent
	AssignedTo  string                 `json:"assigned_to,omitempty"`
	StartDate   *time.Time             `json:"start_date,omitempty"`
	DueDate     *time.Time             `json:"due_date,omitempty"`
	CompletedAt *time.Time             `json:"completed_at,omitempty"`
	Dependencies []string              `json:"dependencies,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}
