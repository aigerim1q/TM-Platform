package projects

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type ProjectStatus string
type ProjectMemberRole string

const (
	ProjectStatusActive    ProjectStatus = "active"
	ProjectStatusCompleted ProjectStatus = "completed"

	ProjectMemberRoleOwner   ProjectMemberRole = "owner"
	ProjectMemberRoleManager ProjectMemberRole = "manager"
	ProjectMemberRoleMember  ProjectMemberRole = "member"
)

func (s ProjectStatus) Valid() bool {
	switch s {
	case ProjectStatusActive, ProjectStatusCompleted:
		return true
	default:
		return false
	}
}

func (r ProjectMemberRole) Valid() bool {
	switch r {
	case ProjectMemberRoleOwner, ProjectMemberRoleManager, ProjectMemberRoleMember:
		return true
	default:
		return false
	}
}

type Project struct {
	ID              uuid.UUID
	OwnerID         uuid.UUID
	CurrentUserRole ProjectMemberRole
	Title           string
	Description     *string
	CoverURL        *string
	IconURL         *string
	StartDate       *time.Time
	Deadline        *time.Time
	EndDate         *time.Time
	Status          ProjectStatus
	TotalBudget     int64
	Blocks          json.RawMessage
	SpentBudget     int64
	RemainingBudget int64
	ProgressPercent float64
	CreatedAt       time.Time
	UpdatedAt       time.Time
	DurationDays    int
}

type ProjectResponse struct {
	ID                   uuid.UUID         `json:"id"`
	CurrentUserRole      ProjectMemberRole `json:"currentUserRole,omitempty"`
	CurrentUserRoleSnake ProjectMemberRole `json:"current_user_role,omitempty"`
	Title                string            `json:"title"`
	Description          *string           `json:"description,omitempty"`
	Status               ProjectStatus     `json:"status"`
	Budget               int64             `json:"budget"`
	TotalBudget          int64             `json:"total_budget"`
	SpentBudget          int64             `json:"spent_budget"`
	RemainingBudget      int64             `json:"remaining_budget"`
	ProgressPercent      float64           `json:"progress_percent"`
	CoverURL             *string           `json:"coverUrl,omitempty"`
	CoverURLSnake        *string           `json:"cover_url,omitempty"`
	IconURL              *string           `json:"iconUrl,omitempty"`
	IconURLSnake         *string           `json:"icon_url,omitempty"`
	StartDate            *time.Time        `json:"startDate,omitempty"`
	StartDateSnake       *time.Time        `json:"start_date,omitempty"`
	Deadline             *time.Time        `json:"deadline,omitempty"`
	EndDate              *time.Time        `json:"end_date,omitempty"`
	Blocks               json.RawMessage   `json:"blocks"`
	CreatedAt            time.Time         `json:"createdAt"`
	CreatedAtSnake       time.Time         `json:"created_at"`
	UpdatedAt            time.Time         `json:"updatedAt"`
	UpdatedAtSnake       time.Time         `json:"updated_at"`
	DurationDays         int               `json:"duration_days,omitempty"`
}

func (p Project) Response() ProjectResponse {
	blocks := p.Blocks
	if len(blocks) == 0 {
		blocks = json.RawMessage("[]")
	}

	deadline := p.Deadline
	if deadline == nil {
		deadline = p.EndDate
	}

	return ProjectResponse{
		ID:                   p.ID,
		CurrentUserRole:      p.CurrentUserRole,
		CurrentUserRoleSnake: p.CurrentUserRole,
		Title:                p.Title,
		Description:          p.Description,
		Status:               p.Status,
		Budget:               p.TotalBudget,
		TotalBudget:          p.TotalBudget,
		SpentBudget:          p.SpentBudget,
		RemainingBudget:      p.RemainingBudget,
		ProgressPercent:      p.ProgressPercent,
		CoverURL:             p.CoverURL,
		CoverURLSnake:        p.CoverURL,
		IconURL:              p.IconURL,
		IconURLSnake:         p.IconURL,
		StartDate:            p.StartDate,
		StartDateSnake:       p.StartDate,
		Deadline:             deadline,
		EndDate:              p.EndDate,
		Blocks:               blocks,
		CreatedAt:            p.CreatedAt,
		CreatedAtSnake:       p.CreatedAt,
		UpdatedAt:            p.UpdatedAt,
		UpdatedAtSnake:       p.UpdatedAt,
		DurationDays:         p.DurationDays,
	}
}

type ProjectExpense struct {
	ID        uuid.UUID `json:"id"`
	ProjectID uuid.UUID `json:"project_id"`
	Title     string    `json:"title"`
	Amount    int64     `json:"amount"`
	CreatedBy uuid.UUID `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
}

type BudgetSummary struct {
	TotalBudget     int64   `json:"total_budget"`
	SpentBudget     int64   `json:"spent_budget"`
	RemainingBudget int64   `json:"remaining_budget"`
	ProgressPercent float64 `json:"progress_percent"`
}

type ProjectMember struct {
	ID        uuid.UUID         `json:"id"`
	ProjectID uuid.UUID         `json:"project_id"`
	UserID    uuid.UUID         `json:"user_id"`
	Role      ProjectMemberRole `json:"role"`
	CreatedAt time.Time         `json:"created_at"`
}

type ProjectMemberUser struct {
	ID    uuid.UUID `json:"id"`
	Email string    `json:"email"`
}

type ProjectMemberResponse struct {
	User ProjectMemberUser `json:"user"`
	Role ProjectMemberRole `json:"role"`
}

type ProjectPage struct {
	ID         uuid.UUID       `json:"id"`
	ProjectID  uuid.UUID       `json:"project_id"`
	Title      string          `json:"title"`
	Blocks     json.RawMessage `json:"blocks"`
	BlocksJSON json.RawMessage `json:"blocks_json"`
	CreatedBy  uuid.UUID       `json:"created_by"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

type Stage struct {
	ID         uuid.UUID `json:"id"`
	ProjectID  uuid.UUID `json:"project_id"`
	Title      string    `json:"title"`
	OrderIndex int       `json:"order_index"`
}

type Task struct {
	ID         uuid.UUID       `json:"id"`
	StageID    uuid.UUID       `json:"stage_id"`
	ProjectID  uuid.UUID       `json:"project_id"`
	Title      string          `json:"title"`
	Status     string          `json:"status"`
	StartDate  *time.Time      `json:"start_date,omitempty"`
	Deadline   *time.Time      `json:"deadline,omitempty"`
	OrderIndex int             `json:"order_index"`
	Blocks     json.RawMessage `json:"blocks"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

type DelayReport struct {
	ID        uuid.UUID  `json:"id"`
	ProjectID uuid.UUID  `json:"project_id"`
	UserID    uuid.UUID  `json:"user_id"`
	StageID   *uuid.UUID `json:"stage_id,omitempty"`
	TaskID    *uuid.UUID `json:"task_id,omitempty"`
	Message   string     `json:"message"`
	CreatedAt time.Time  `json:"created_at"`
}

type DelayReportAuthor struct {
	ID    uuid.UUID `json:"id"`
	Email string    `json:"email"`
}

type DelayReportResponse struct {
	ID        uuid.UUID         `json:"id"`
	ProjectID uuid.UUID         `json:"project_id"`
	UserID    uuid.UUID         `json:"user_id"`
	StageID   *uuid.UUID        `json:"stage_id,omitempty"`
	TaskID    *uuid.UUID        `json:"task_id,omitempty"`
	Message   string            `json:"message"`
	CreatedAt time.Time         `json:"created_at"`
	Author    DelayReportAuthor `json:"author"`
}

type TaskComment struct {
	ID        uuid.UUID `json:"id"`
	TaskID    uuid.UUID `json:"task_id"`
	ProjectID uuid.UUID `json:"project_id"`
	UserID    uuid.UUID `json:"user_id"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

type TaskCommentAuthor struct {
	ID    uuid.UUID `json:"id"`
	Email string    `json:"email"`
}

type TaskCommentResponse struct {
	ID        uuid.UUID         `json:"id"`
	TaskID    uuid.UUID         `json:"task_id"`
	ProjectID uuid.UUID         `json:"project_id"`
	UserID    uuid.UUID         `json:"user_id"`
	Message   string            `json:"message"`
	CreatedAt time.Time         `json:"created_at"`
	Author    TaskCommentAuthor `json:"author"`
}

func CalculateDurationDays(start, end *time.Time) int {
	if start == nil || end == nil {
		return 0
	}
	if end.Before(*start) {
		return 0
	}
	return int(end.Sub(*start).Hours() / 24)
}
