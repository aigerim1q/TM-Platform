package projects

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/google/uuid"
)

var ErrDelayReportCommentForbidden = errors.New("delay report comment forbidden")

func scanReportChatMessageResponse(scanner rowScanner) (ReportChatMessageResponse, error) {
	var (
		message     ReportChatMessageResponse
		taskIDRaw   sql.NullString
		authorIDRaw uuid.UUID
		authorEmail string
	)

	if err := scanner.Scan(
		&message.ID,
		&message.ProjectID,
		&taskIDRaw,
		&message.UserID,
		&message.Message,
		&message.CreatedAt,
		&authorIDRaw,
		&authorEmail,
	); err != nil {
		return ReportChatMessageResponse{}, err
	}

	if taskIDRaw.Valid {
		parsedTaskID, parseErr := uuid.Parse(taskIDRaw.String)
		if parseErr != nil {
			return ReportChatMessageResponse{}, parseErr
		}
		message.TaskID = &parsedTaskID
	}

	message.Author = ReportChatMessageAuthor{
		ID:    authorIDRaw,
		Email: authorEmail,
	}

	return message, nil
}

func scanDelayReportCommentResponse(scanner rowScanner) (DelayReportCommentResponse, error) {
	var (
		comment     DelayReportCommentResponse
		parentIDRaw sql.NullString
		authorIDRaw uuid.UUID
		authorEmail string
	)

	if err := scanner.Scan(
		&comment.ID,
		&comment.ReportID,
		&comment.ProjectID,
		&comment.UserID,
		&parentIDRaw,
		&comment.Message,
		&comment.CreatedAt,
		&authorIDRaw,
		&authorEmail,
		&comment.ReplyCount,
	); err != nil {
		return DelayReportCommentResponse{}, err
	}

	if parentIDRaw.Valid {
		parsedParentID, parseErr := uuid.Parse(parentIDRaw.String)
		if parseErr != nil {
			return DelayReportCommentResponse{}, parseErr
		}
		comment.ParentID = &parsedParentID
	}

	comment.Author = DelayReportCommentAuthor{
		ID:    authorIDRaw,
		Email: authorEmail,
	}

	return comment, nil
}

func (r *Repository) ListProjectReportChatMessages(ctx context.Context, requesterID, projectID uuid.UUID) ([]ReportChatMessageResponse, error) {
	if err := r.isProjectMember(ctx, requesterID, projectID); err != nil {
		return nil, err
	}

	rows, err := r.db.QueryContext(
		ctx,
		`SELECT m.id, m.project_id, m.task_id, m.user_id, m.message, m.created_at, u.id, u.email
		 FROM report_chat_messages m
		 JOIN users u ON u.id = m.user_id
		 WHERE m.project_id = $1
		   AND m.task_id IS NULL
		 ORDER BY m.created_at ASC, m.id ASC`,
		projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := make([]ReportChatMessageResponse, 0)
	for rows.Next() {
		message, scanErr := scanReportChatMessageResponse(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		messages = append(messages, message)
	}

	return messages, rows.Err()
}

func (r *Repository) CreateProjectReportChatMessage(ctx context.Context, requesterID, projectID uuid.UUID, message string) (ReportChatMessageResponse, error) {
	if err := r.isProjectMember(ctx, requesterID, projectID); err != nil {
		return ReportChatMessageResponse{}, err
	}

	row := r.db.QueryRowContext(
		ctx,
		`WITH inserted AS (
		 	INSERT INTO report_chat_messages (project_id, user_id, message)
		 	VALUES ($1, $2, $3)
		 	RETURNING id, project_id, task_id, user_id, message, created_at
		 )
		 SELECT i.id, i.project_id, i.task_id, i.user_id, i.message, i.created_at, u.id, u.email
		 FROM inserted i
		 JOIN users u ON u.id = i.user_id`,
		projectID,
		requesterID,
		message,
	)

	return scanReportChatMessageResponse(row)
}

func (r *Repository) ListTaskReportChatMessages(ctx context.Context, requesterID, taskID uuid.UUID) ([]ReportChatMessageResponse, error) {
	if err := r.ensureTaskMember(ctx, requesterID, taskID); err != nil {
		return nil, err
	}

	rows, err := r.db.QueryContext(
		ctx,
		`SELECT m.id, m.project_id, m.task_id, m.user_id, m.message, m.created_at, u.id, u.email
		 FROM report_chat_messages m
		 JOIN users u ON u.id = m.user_id
		 WHERE m.task_id = $1
		 ORDER BY m.created_at ASC, m.id ASC`,
		taskID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := make([]ReportChatMessageResponse, 0)
	for rows.Next() {
		message, scanErr := scanReportChatMessageResponse(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		messages = append(messages, message)
	}

	return messages, rows.Err()
}

func (r *Repository) CreateTaskReportChatMessage(ctx context.Context, requesterID, taskID uuid.UUID, message string) (ReportChatMessageResponse, error) {
	canWrite, err := r.CanWriteTaskDiscussion(ctx, requesterID, taskID)
	if err != nil {
		return ReportChatMessageResponse{}, err
	}
	if !canWrite {
		return ReportChatMessageResponse{}, ErrTaskCommentForbidden
	}

	row := r.db.QueryRowContext(
		ctx,
		`WITH task_ctx AS (
		 	SELECT t.id AS task_id, s.project_id
		 	FROM stage_tasks t
		 	JOIN project_stages s ON s.id = t.stage_id
		 	WHERE t.id = $1
		 ), inserted AS (
		 	INSERT INTO report_chat_messages (project_id, task_id, user_id, message)
		 	SELECT tc.project_id, tc.task_id, $2, $3
		 	FROM task_ctx tc
		 	RETURNING id, project_id, task_id, user_id, message, created_at
		 )
		 SELECT i.id, i.project_id, i.task_id, i.user_id, i.message, i.created_at, u.id, u.email
		 FROM inserted i
		 JOIN users u ON u.id = i.user_id`,
		taskID,
		requesterID,
		message,
	)

	return scanReportChatMessageResponse(row)
}

func (r *Repository) ResolveDelayReportTaskID(ctx context.Context, requesterID, projectID, reportID uuid.UUID) (*uuid.UUID, error) {
	if err := r.isProjectMember(ctx, requesterID, projectID); err != nil {
		return nil, err
	}

	var taskIDRaw sql.NullString
	if err := r.db.QueryRowContext(
		ctx,
		`SELECT task_id
		 FROM delay_reports
		 WHERE id = $1
		   AND project_id = $2`,
		reportID,
		projectID,
	).Scan(&taskIDRaw); err != nil {
		return nil, err
	}

	if !taskIDRaw.Valid || strings.TrimSpace(taskIDRaw.String) == "" {
		return nil, nil
	}

	parsedTaskID, parseErr := uuid.Parse(taskIDRaw.String)
	if parseErr != nil {
		return nil, parseErr
	}

	return &parsedTaskID, nil
}

func (r *Repository) ListDelayReportComments(ctx context.Context, requesterID, projectID, reportID uuid.UUID) ([]DelayReportCommentResponse, error) {
	if err := r.isProjectMember(ctx, requesterID, projectID); err != nil {
		return nil, err
	}

	rows, err := r.db.QueryContext(
		ctx,
		`SELECT c.id, c.report_id, c.project_id, c.user_id, c.parent_id, c.message, c.created_at, u.id, u.email,
		 	COALESCE((SELECT COUNT(*) FROM delay_report_comments child WHERE child.parent_id = c.id), 0) AS reply_count
		 FROM delay_report_comments c
		 JOIN users u ON u.id = c.user_id
		 WHERE c.project_id = $1
		   AND c.report_id = $2
		 ORDER BY c.created_at ASC, c.id ASC`,
		projectID,
		reportID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	comments := make([]DelayReportCommentResponse, 0)
	for rows.Next() {
		comment, scanErr := scanDelayReportCommentResponse(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		comments = append(comments, comment)
	}

	return comments, rows.Err()
}

func (r *Repository) CreateDelayReportComment(ctx context.Context, requesterID, projectID, reportID uuid.UUID, parentID *uuid.UUID, message string) (DelayReportCommentResponse, error) {
	if err := r.isProjectMember(ctx, requesterID, projectID); err != nil {
		return DelayReportCommentResponse{}, err
	}

	var parentValue any
	if parentID != nil {
		parentValue = *parentID
	}

	row := r.db.QueryRowContext(
		ctx,
		`WITH target_report AS (
		 	SELECT id, project_id
		 	FROM delay_reports
		 	WHERE id = $2
		 	  AND project_id = $1
		 ), parent_ok AS (
		 	SELECT id
		 	FROM delay_report_comments
		 	WHERE id = $4
		 	  AND report_id = $2
		 	  AND project_id = $1
		 ), inserted AS (
		 	INSERT INTO delay_report_comments (report_id, project_id, user_id, parent_id, message)
		 	SELECT tr.id, tr.project_id, $3, $4, $5
		 	FROM target_report tr
		 	WHERE $4::uuid IS NULL OR EXISTS (SELECT 1 FROM parent_ok)
		 	RETURNING id, report_id, project_id, user_id, parent_id, message, created_at
		 )
		 SELECT i.id, i.report_id, i.project_id, i.user_id, i.parent_id, i.message, i.created_at, u.id, u.email,
		 	COALESCE((SELECT COUNT(*) FROM delay_report_comments child WHERE child.parent_id = i.id), 0) AS reply_count
		 FROM inserted i
		 JOIN users u ON u.id = i.user_id`,
		projectID,
		reportID,
		requesterID,
		parentValue,
		message,
	)

	comment, err := scanDelayReportCommentResponse(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return DelayReportCommentResponse{}, ErrDelayReportCommentForbidden
		}
		return DelayReportCommentResponse{}, err
	}

	return comment, nil
}
