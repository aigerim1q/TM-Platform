package projectfiles

import (
	"time"

	"github.com/google/uuid"
)

type ProjectFile struct {
	ID        uuid.UUID `json:"id"`
	ProjectID uuid.UUID `json:"project_id"`
	URL       string    `json:"url"`
	Type      string    `json:"type"`
	Name      string    `json:"name"`
	Size      int64     `json:"size"`
	CreatedAt time.Time `json:"created_at"`
}

type Document struct {
	ID          uuid.UUID `json:"id"`
	ProjectID   uuid.UUID `json:"project_id"`
	ProjectName string    `json:"project_name"`
	URL         string    `json:"url"`
	Type        string    `json:"type"`
	Name        string    `json:"name"`
	Size        int64     `json:"size"`
	CreatedAt   time.Time `json:"created_at"`
	Status      string    `json:"status"`
}

type CreateProjectFileInput struct {
	ProjectID uuid.UUID
	URL       string
	Type      string
	Name      string
	Size      int64
}
