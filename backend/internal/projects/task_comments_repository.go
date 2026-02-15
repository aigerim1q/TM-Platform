package projects

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"

	"github.com/google/uuid"
)

var ErrTaskCommentForbidden = errors.New("task comment forbidden")

type taskMetaBlock struct {
	ID      string `json:"id"`
	Content string `json:"content"`
}

type taskMetaPayload struct {
	Assignees []string `json:"assignees"`
}

func normalizeAssigneeValues(values []string) map[string]struct{} {
	out := make(map[string]struct{}, len(values))
	for _, value := range values {
		normalized := strings.ToLower(strings.TrimSpace(value))
		if normalized == "" {
			continue
		}
		out[normalized] = struct{}{}
	}
	return out
}

func assigneesFromBlocks(blocks []byte) map[string]struct{} {
	if len(blocks) == 0 {
		return map[string]struct{}{}
	}

	var rawBlocks []taskMetaBlock
	if err := json.Unmarshal(blocks, &rawBlocks); err != nil {
		return map[string]struct{}{}
	}

	for _, block := range rawBlocks {
		if block.ID != "__task_meta__" || strings.TrimSpace(block.Content) == "" {
			continue
		}

		var payload taskMetaPayload
		if err := json.Unmarshal([]byte(block.Content), &payload); err != nil {
			return map[string]struct{}{}
		}

		return normalizeAssigneeValues(payload.Assignees)
	}

	return map[string]struct{}{}
}

func (r *Repository) ensureTaskMember(ctx context.Context, requesterID, taskID uuid.UUID) error {
	var exists int
	err := r.db.QueryRowContext(
		ctx,
		`SELECT 1
		 FROM stage_tasks t
		 JOIN project_stages s ON s.id = t.stage_id
		 JOIN project_members pm ON pm.project_id = s.project_id
		 WHERE t.id = $1
		   AND pm.user_id = $2`,
		taskID,
		requesterID,
	).Scan(&exists)
	return err
}

func (r *Repository) CanWriteTaskDiscussion(ctx context.Context, requesterID, taskID uuid.UUID) (bool, error) {
	var (
		projectID uuid.UUID
		blocks    []byte
	)

	if err := r.db.QueryRowContext(
		ctx,
		`SELECT s.project_id, t.blocks
		 FROM stage_tasks t
		 JOIN project_stages s ON s.id = t.stage_id
		 WHERE t.id = $1`,
		taskID,
	).Scan(&projectID, &blocks); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, sql.ErrNoRows
		}
		return false, err
	}

	var (
		role  string
		email string
	)
	if err := r.db.QueryRowContext(
		ctx,
		`SELECT pm.role, u.email
		 FROM project_members pm
		 JOIN users u ON u.id = pm.user_id
		 WHERE pm.project_id = $1
		   AND pm.user_id = $2`,
		projectID,
		requesterID,
	).Scan(&role, &email); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}

	switch ProjectMemberRole(role) {
	case ProjectMemberRoleOwner, ProjectMemberRoleManager:
		return true, nil
	}

	assignees := assigneesFromBlocks(blocks)
	if len(assignees) == 0 {
		return false, nil
	}

	requesterIDString := strings.ToLower(strings.TrimSpace(requesterID.String()))
	requesterEmail := strings.ToLower(strings.TrimSpace(email))

	if _, ok := assignees[requesterIDString]; ok {
		return true, nil
	}
	if requesterEmail != "" {
		if _, ok := assignees[requesterEmail]; ok {
			return true, nil
		}
	}

	return false, nil
}

func scanTaskCommentResponse(scanner rowScanner) (TaskCommentResponse, error) {
	var (
		comment     TaskCommentResponse
		authorID    uuid.UUID
		authorEmail string
	)

	if err := scanner.Scan(
		&comment.ID,
		&comment.TaskID,
		&comment.ProjectID,
		&comment.UserID,
		&comment.Message,
		&comment.CreatedAt,
		&authorID,
		&authorEmail,
	); err != nil {
		return TaskCommentResponse{}, err
	}

	comment.Author = TaskCommentAuthor{
		ID:    authorID,
		Email: authorEmail,
	}

	return comment, nil
}

func (r *Repository) CreateTaskComment(ctx context.Context, requesterID, taskID uuid.UUID, message string) (TaskCommentResponse, error) {
	canWrite, err := r.CanWriteTaskDiscussion(ctx, requesterID, taskID)
	if err != nil {
		return TaskCommentResponse{}, err
	}
	if !canWrite {
		return TaskCommentResponse{}, ErrTaskCommentForbidden
	}

	row := r.db.QueryRowContext(
		ctx,
		`WITH inserted AS (
		 	INSERT INTO task_comments (task_id, user_id, message)
		 	VALUES ($1, $2, $3)
		 	RETURNING id, task_id, user_id, message, created_at
		 )
		 SELECT i.id, i.task_id, s.project_id, i.user_id, i.message, i.created_at, u.id, u.email
		 FROM inserted i
		 JOIN stage_tasks t ON t.id = i.task_id
		 JOIN project_stages s ON s.id = t.stage_id
		 JOIN users u ON u.id = i.user_id`,
		taskID,
		requesterID,
		message,
	)

	return scanTaskCommentResponse(row)
}

func (r *Repository) ListTaskComments(ctx context.Context, requesterID, taskID uuid.UUID) ([]TaskCommentResponse, error) {
	if err := r.ensureTaskMember(ctx, requesterID, taskID); err != nil {
		return nil, err
	}

	rows, err := r.db.QueryContext(
		ctx,
		`SELECT tc.id, tc.task_id, s.project_id, tc.user_id, tc.message, tc.created_at, u.id, u.email
		 FROM task_comments tc
		 JOIN stage_tasks t ON t.id = tc.task_id
		 JOIN project_stages s ON s.id = t.stage_id
		 JOIN users u ON u.id = tc.user_id
		 WHERE tc.task_id = $1
		 ORDER BY tc.created_at ASC, tc.id ASC`,
		taskID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	comments := make([]TaskCommentResponse, 0)
	for rows.Next() {
		comment, scanErr := scanTaskCommentResponse(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		comments = append(comments, comment)
	}

	return comments, rows.Err()
}

func (r *Repository) ListTaskHistory(ctx context.Context, requesterID, taskID uuid.UUID) ([]DelayReportResponse, error) {
	if err := r.ensureTaskMember(ctx, requesterID, taskID); err != nil {
		return nil, err
	}

	rows, err := r.db.QueryContext(
		ctx,
		`SELECT dr.id, dr.project_id, dr.user_id, dr.stage_id, dr.task_id, dr.message, dr.created_at, u.id, u.email
		 FROM delay_reports dr
		 JOIN users u ON u.id = dr.user_id
		 WHERE dr.task_id = $1
		 ORDER BY dr.created_at DESC, dr.id DESC`,
		taskID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	history := make([]DelayReportResponse, 0)
	for rows.Next() {
		item, scanErr := scanDelayReportResponse(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		history = append(history, item)
	}

	return history, rows.Err()
}
