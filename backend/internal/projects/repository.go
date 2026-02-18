package projects

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
)

type Repository struct {
	db *sql.DB
}

var ErrCannotAssignOwnerAsManager = errors.New("owner cannot be manager")

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

type ProjectInput struct {
	Title       string
	Description *string
	CoverURL    *string
	IconURL     *string
	StartDate   *time.Time
	EndDate     *time.Time
	Deadline    *time.Time
	Status      ProjectStatus
	TotalBudget int64
	Blocks      []byte
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanProject(scanner rowScanner) (Project, error) {
	var (
		project     Project
		description sql.NullString
		coverURL    sql.NullString
		iconURL     sql.NullString
		startDate   sql.NullTime
		deadline    sql.NullTime
		endDate     sql.NullTime
		status      string
		blocks      []byte
		createdAt   time.Time
		updatedAt   time.Time
	)

	err := scanner.Scan(
		&project.ID,
		&project.OwnerID,
		&project.Title,
		&description,
		&coverURL,
		&iconURL,
		&startDate,
		&deadline,
		&endDate,
		&status,
		&project.TotalBudget,
		&blocks,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return Project{}, err
	}

	if description.Valid {
		project.Description = &description.String
	}
	if coverURL.Valid {
		project.CoverURL = &coverURL.String
	}
	if iconURL.Valid {
		project.IconURL = &iconURL.String
	}
	if startDate.Valid {
		project.StartDate = &startDate.Time
	}
	if deadline.Valid {
		project.Deadline = &deadline.Time
	}
	if endDate.Valid {
		project.EndDate = &endDate.Time
	}
	project.Blocks = blocks
	project.CreatedAt = createdAt
	project.UpdatedAt = updatedAt

	project.Status = ProjectStatus(status)
	endForDuration := project.Deadline
	if endForDuration == nil {
		endForDuration = project.EndDate
	}
	project.DurationDays = CalculateDurationDays(project.StartDate, endForDuration)
	return project, nil
}

func (r *Repository) Create(ctx context.Context, ownerID uuid.UUID, input ProjectInput) (Project, error) {
	blocks := input.Blocks
	if len(blocks) == 0 {
		blocks = []byte("[]")
	}
	deadline := input.Deadline
	if deadline == nil {
		deadline = input.EndDate
	}
	endDate := deadline

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return Project{}, err
	}
	defer tx.Rollback()

	row := tx.QueryRowContext(
		ctx,
		`INSERT INTO projects (owner_id, title, description, cover_url, icon_url, start_date, deadline, end_date, status, total_budget, blocks)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		 RETURNING id, owner_id, title, description, cover_url, icon_url, start_date, deadline, end_date, status, total_budget, blocks, created_at, updated_at`,
		ownerID,
		input.Title,
		nullString(input.Description),
		nullString(input.CoverURL),
		nullString(input.IconURL),
		nullTime(input.StartDate),
		nullTime(deadline),
		nullTime(endDate),
		string(input.Status),
		input.TotalBudget,
		blocks,
	)

	project, err := scanProject(row)
	if err != nil {
		return Project{}, err
	}

	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO project_members (project_id, user_id, role)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
		project.ID,
		ownerID,
		string(ProjectMemberRoleOwner),
	); err != nil {
		return Project{}, err
	}

	if err := tx.Commit(); err != nil {
		return Project{}, err
	}

	if err := r.populateProjectBudget(ctx, ownerID, &project); err != nil {
		return Project{}, err
	}
	if err := r.populateProjectRole(ctx, ownerID, &project); err != nil {
		return Project{}, err
	}
	return project, nil
}

func (r *Repository) CreateWithID(ctx context.Context, ownerID, projectID uuid.UUID, input ProjectInput) (Project, error) {
	blocks := input.Blocks
	if len(blocks) == 0 {
		blocks = []byte("[]")
	}
	deadline := input.Deadline
	if deadline == nil {
		deadline = input.EndDate
	}
	endDate := deadline

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return Project{}, err
	}
	defer tx.Rollback()

	row := tx.QueryRowContext(
		ctx,
		`INSERT INTO projects (id, owner_id, title, description, cover_url, icon_url, start_date, deadline, end_date, status, total_budget, blocks)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		 RETURNING id, owner_id, title, description, cover_url, icon_url, start_date, deadline, end_date, status, total_budget, blocks, created_at, updated_at`,
		projectID,
		ownerID,
		input.Title,
		nullString(input.Description),
		nullString(input.CoverURL),
		nullString(input.IconURL),
		nullTime(input.StartDate),
		nullTime(deadline),
		nullTime(endDate),
		string(input.Status),
		input.TotalBudget,
		blocks,
	)

	project, err := scanProject(row)
	if err != nil {
		return Project{}, err
	}

	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO project_members (project_id, user_id, role)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
		project.ID,
		ownerID,
		string(ProjectMemberRoleOwner),
	); err != nil {
		return Project{}, err
	}

	if err := tx.Commit(); err != nil {
		return Project{}, err
	}

	if err := r.populateProjectBudget(ctx, ownerID, &project); err != nil {
		return Project{}, err
	}
	if err := r.populateProjectRole(ctx, ownerID, &project); err != nil {
		return Project{}, err
	}
	return project, nil
}

func (r *Repository) ListByOwner(ctx context.Context, ownerID uuid.UUID) ([]Project, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT id, owner_id, title, description, cover_url, icon_url, start_date, deadline, end_date, status, total_budget, blocks, created_at, updated_at
		 FROM projects
		 WHERE EXISTS (
		 	SELECT 1
		 	FROM project_members pm
		 	WHERE pm.project_id = projects.id AND pm.user_id = $1
		 )
		 ORDER BY start_date DESC NULLS LAST, id DESC`,
		ownerID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		project, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		if err := r.populateProjectBudget(ctx, ownerID, &project); err != nil {
			return nil, err
		}
		if err := r.populateProjectRole(ctx, ownerID, &project); err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}

	return projects, rows.Err()
}

func (r *Repository) GetByID(ctx context.Context, ownerID, projectID uuid.UUID) (Project, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT id, owner_id, title, description, cover_url, icon_url, start_date, deadline, end_date, status, total_budget, blocks, created_at, updated_at
		 FROM projects
		 WHERE id = $1
		   AND EXISTS (
		 	SELECT 1
		 	FROM project_members pm
		 	WHERE pm.project_id = projects.id AND pm.user_id = $2
		   )`,
		projectID,
		ownerID,
	)

	project, err := scanProject(row)
	if err != nil {
		return Project{}, err
	}
	if err := r.populateProjectBudget(ctx, ownerID, &project); err != nil {
		return Project{}, err
	}
	if err := r.populateProjectRole(ctx, ownerID, &project); err != nil {
		return Project{}, err
	}
	return project, nil
}

func (r *Repository) Update(ctx context.Context, ownerID, projectID uuid.UUID, input ProjectInput) (Project, error) {
	blocks := input.Blocks
	if len(blocks) == 0 {
		blocks = []byte("[]")
	}
	deadline := input.Deadline
	if deadline == nil {
		deadline = input.EndDate
	}
	endDate := deadline

	row := r.db.QueryRowContext(
		ctx,
		`UPDATE projects
		 SET title = $3,
			 description = $4,
			 cover_url = $5,
			 icon_url = $6,
			 start_date = $7,
			 deadline = $8,
			 end_date = $9,
			 status = $10,
			 total_budget = $11,
			 blocks = $12,
			 updated_at = now()
		 WHERE id = $1
		   AND EXISTS (
		 	SELECT 1
		 	FROM project_members pm
		 	WHERE pm.project_id = projects.id
		 	  AND pm.user_id = $2
		 	  AND pm.role IN ('owner', 'manager')
		   )
		 RETURNING id, owner_id, title, description, cover_url, icon_url, start_date, deadline, end_date, status, total_budget, blocks, created_at, updated_at`,
		projectID,
		ownerID,
		input.Title,
		nullString(input.Description),
		nullString(input.CoverURL),
		nullString(input.IconURL),
		nullTime(input.StartDate),
		nullTime(deadline),
		nullTime(endDate),
		string(input.Status),
		input.TotalBudget,
		blocks,
	)

	project, err := scanProject(row)
	if err != nil {
		return Project{}, err
	}
	if err := r.populateProjectBudget(ctx, ownerID, &project); err != nil {
		return Project{}, err
	}
	if err := r.populateProjectRole(ctx, ownerID, &project); err != nil {
		return Project{}, err
	}
	return project, nil
}

func (r *Repository) Delete(ctx context.Context, ownerID, projectID uuid.UUID) error {
	result, err := r.db.ExecContext(
		ctx,
		`DELETE FROM projects
		 WHERE id = $1
		   AND EXISTS (
		 	SELECT 1
		 	FROM project_members pm
		 	WHERE pm.project_id = projects.id
		 	  AND pm.user_id = $2
		 	  AND pm.role IN ('owner', 'manager')
		   )`,
		projectID,
		ownerID,
	)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *Repository) CreateExpense(ctx context.Context, ownerID, projectID, createdBy uuid.UUID, title string, amount int64) (ProjectExpense, error) {
	row := r.db.QueryRowContext(
		ctx,
		`INSERT INTO project_expenses (project_id, title, amount, created_by)
		 SELECT p.id, $3, $4, $5
		 FROM projects p
		 WHERE p.id = $1
		   AND EXISTS (
		 	SELECT 1
		 	FROM project_members pm
		 	WHERE pm.project_id = p.id
		 	  AND pm.user_id = $2
		   )
		 RETURNING id, project_id, title, amount, created_by, created_at`,
		projectID,
		ownerID,
		title,
		amount,
		createdBy,
	)

	return scanExpense(row)
}

func (r *Repository) ListExpenses(ctx context.Context, ownerID, projectID uuid.UUID) ([]ProjectExpense, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT e.id, e.project_id, e.title, e.amount, e.created_by, e.created_at
		 FROM project_expenses e
		 WHERE e.project_id = $1
		   AND EXISTS (
		 	SELECT 1
		 	FROM project_members pm
		 	WHERE pm.project_id = e.project_id AND pm.user_id = $2
		   )
		 ORDER BY e.created_at DESC, e.id DESC`,
		projectID,
		ownerID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var expenses []ProjectExpense
	for rows.Next() {
		expense, err := scanExpense(rows)
		if err != nil {
			return nil, err
		}
		expenses = append(expenses, expense)
	}

	return expenses, rows.Err()
}

func (r *Repository) GetBudget(ctx context.Context, ownerID, projectID uuid.UUID) (BudgetSummary, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT p.total_budget,
		 COALESCE(SUM(e.amount), 0) AS spent_budget
		 FROM projects p
		 LEFT JOIN project_expenses e ON e.project_id = p.id
		 WHERE p.id = $1
		   AND EXISTS (
		 	SELECT 1
		 	FROM project_members pm
		 	WHERE pm.project_id = p.id AND pm.user_id = $2
		   )
		 GROUP BY p.total_budget`,
		projectID,
		ownerID,
	)

	var summary BudgetSummary
	if err := row.Scan(&summary.TotalBudget, &summary.SpentBudget); err != nil {
		return BudgetSummary{}, err
	}
	summary.RemainingBudget = summary.TotalBudget - summary.SpentBudget
	summary.ProgressPercent = calculateProgressPercent(summary.SpentBudget, summary.TotalBudget)
	return summary, nil
}

func (r *Repository) DeleteExpense(ctx context.Context, ownerID, expenseID uuid.UUID) error {
	result, err := r.db.ExecContext(
		ctx,
		`DELETE FROM project_expenses e
		 USING projects p, project_members pm
		 WHERE e.id = $1
		   AND p.id = e.project_id
		   AND pm.project_id = p.id
		   AND pm.user_id = $2
		   AND pm.role IN ('owner', 'manager')`,
		expenseID,
		ownerID,
	)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *Repository) CreateStage(ctx context.Context, ownerID, projectID uuid.UUID, title string, orderIndex int) (Stage, error) {
	row := r.db.QueryRowContext(
		ctx,
		`INSERT INTO project_stages (project_id, title, order_index)
		 SELECT p.id, $2, $3
		 FROM projects p
		 WHERE p.id = $1
		   AND EXISTS (
		 	SELECT 1
		 	FROM project_members pm
		 	WHERE pm.project_id = p.id
		 	  AND pm.user_id = $4
		 	  AND pm.role IN ('owner', 'manager')
		   )
		 RETURNING id, project_id, title, order_index`,
		projectID,
		title,
		orderIndex,
		ownerID,
	)

	var stage Stage
	if err := row.Scan(&stage.ID, &stage.ProjectID, &stage.Title, &stage.OrderIndex); err != nil {
		return Stage{}, err
	}
	return stage, nil
}

func (r *Repository) ListStagesByProject(ctx context.Context, ownerID, projectID uuid.UUID) ([]Stage, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT s.id, s.project_id, s.title, s.order_index
		 FROM project_stages s
		 WHERE s.project_id = $1
		   AND EXISTS (
		 	SELECT 1
		 	FROM project_members pm
		 	WHERE pm.project_id = s.project_id AND pm.user_id = $2
		   )
		 ORDER BY s.order_index ASC, s.created_at ASC`,
		projectID,
		ownerID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stages := make([]Stage, 0)
	for rows.Next() {
		var stage Stage
		if err := rows.Scan(&stage.ID, &stage.ProjectID, &stage.Title, &stage.OrderIndex); err != nil {
			return nil, err
		}
		stages = append(stages, stage)
	}

	return stages, rows.Err()
}

func (r *Repository) UpdateStage(ctx context.Context, ownerID, stageID uuid.UUID, title string, orderIndex int) (Stage, error) {
	row := r.db.QueryRowContext(
		ctx,
		`UPDATE project_stages s
		 SET title = $2,
			 order_index = $3
		 FROM project_members pm
		 WHERE s.id = $1
		   AND pm.project_id = s.project_id
		   AND pm.user_id = $4
		   AND pm.role IN ('owner', 'manager')
		 RETURNING s.id, s.project_id, s.title, s.order_index`,
		stageID,
		title,
		orderIndex,
		ownerID,
	)

	var stage Stage
	if err := row.Scan(&stage.ID, &stage.ProjectID, &stage.Title, &stage.OrderIndex); err != nil {
		return Stage{}, err
	}
	return stage, nil
}

func (r *Repository) DeleteStage(ctx context.Context, ownerID, stageID uuid.UUID) error {
	result, err := r.db.ExecContext(
		ctx,
		`DELETE FROM project_stages s
		 USING project_members pm
		 WHERE s.id = $1
		   AND pm.project_id = s.project_id
		   AND pm.user_id = $2
		   AND pm.role IN ('owner', 'manager')`,
		stageID,
		ownerID,
	)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *Repository) DeleteStageByProject(ctx context.Context, ownerID, projectID, stageID uuid.UUID) error {
	result, err := r.db.ExecContext(
		ctx,
		`DELETE FROM project_stages s
		 USING project_members pm
		 WHERE s.id = $1
		   AND s.project_id = $2
		   AND pm.project_id = s.project_id
		   AND pm.user_id = $3
		   AND pm.role IN ('owner', 'manager')`,
		stageID,
		projectID,
		ownerID,
	)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *Repository) CreateTask(ctx context.Context, ownerID, stageID uuid.UUID, title, status string, startDate, deadline *time.Time, orderIndex int) (Task, error) {
	row := r.db.QueryRowContext(
		ctx,
		`WITH inserted AS (
	 		INSERT INTO stage_tasks (stage_id, title, status, start_date, deadline, order_index, blocks)
	 		SELECT s.id, $2, $3, $4, $5, $6, '[]'::jsonb
		 	FROM project_stages s
		 	JOIN projects p ON p.id = s.project_id
		 	LEFT JOIN project_members pm ON pm.project_id = s.project_id AND pm.user_id = $7
		 	WHERE s.id = $1
		 	  AND (
		 		p.owner_id = $7
		 		OR pm.role IN ('owner', 'manager')
		 	  )
	 		RETURNING id, stage_id, title, status, start_date, deadline, order_index, blocks, updated_at
		 )
		 SELECT i.id, i.stage_id, s.project_id, i.title, i.status, i.start_date, i.deadline, i.order_index, i.blocks, i.updated_at
		 FROM inserted i
		 JOIN project_stages s ON s.id = i.stage_id`,
		stageID,
		title,
		status,
		nullTime(startDate),
		nullTime(deadline),
		orderIndex,
		ownerID,
	)

	return scanTask(row)
}

func (r *Repository) GetTaskByID(ctx context.Context, ownerID, taskID uuid.UUID) (Task, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT t.id, t.stage_id, s.project_id, t.title, t.status, t.start_date, t.deadline, t.order_index, t.blocks, t.updated_at
		 FROM stage_tasks t
		 JOIN project_stages s ON s.id = t.stage_id
		 WHERE t.id = $1
		   AND EXISTS (
		 	SELECT 1
		 	FROM project_members pm
		 	WHERE pm.project_id = s.project_id AND pm.user_id = $2
		   )`,
		taskID,
		ownerID,
	)

	return scanTask(row)
}

func (r *Repository) ListTasksByStage(ctx context.Context, ownerID, stageID uuid.UUID) ([]Task, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT t.id, t.stage_id, s.project_id, t.title, t.status, t.start_date, t.deadline, t.order_index, t.blocks, t.updated_at
		 FROM stage_tasks t
		 JOIN project_stages s ON s.id = t.stage_id
		 WHERE t.stage_id = $1
		   AND EXISTS (
		 	SELECT 1
		 	FROM project_members pm
		 	WHERE pm.project_id = s.project_id AND pm.user_id = $2
		   )
		 ORDER BY t.order_index ASC, t.created_at ASC`,
		stageID,
		ownerID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]Task, 0)
	for rows.Next() {
		task, scanErr := scanTask(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		tasks = append(tasks, task)
	}

	return tasks, rows.Err()
}

func (r *Repository) UpdateTask(ctx context.Context, ownerID, taskID uuid.UUID, title, status string, startDate, deadline *time.Time, stageID *uuid.UUID, orderIndex int, blocks []byte) (Task, error) {
	if len(blocks) == 0 {
		blocks = []byte("[]")
	}

	row := r.db.QueryRowContext(
		ctx,
		`UPDATE stage_tasks t
		 SET title = $2,
			 status = $3,
			 start_date = $4,
			 deadline = $5,
			 stage_id = COALESCE($9, t.stage_id),
			 order_index = $6,
			 blocks = $7,
			 updated_at = now()
		 FROM project_stages s
		 JOIN projects p ON p.id = s.project_id
		 LEFT JOIN project_members pm ON pm.project_id = s.project_id AND pm.user_id = $8
		 WHERE t.id = $1
		   AND s.id = t.stage_id
		   AND (
			p.owner_id = $8
			OR pm.role IN ('owner', 'manager')
		   )
		   AND (
			 $9::uuid IS NULL
			 OR EXISTS (
				SELECT 1
				FROM project_stages s_target
				JOIN projects p_target ON p_target.id = s_target.project_id
				LEFT JOIN project_members pm_target ON pm_target.project_id = s_target.project_id AND pm_target.user_id = $8
				WHERE s_target.id = $9
				  AND (
					p_target.owner_id = $8
					OR pm_target.role IN ('owner', 'manager')
				  )
			 )
		   )
		 RETURNING t.id, t.stage_id, (SELECT project_id FROM project_stages WHERE id = t.stage_id), t.title, t.status, t.start_date, t.deadline, t.order_index, t.blocks, t.updated_at`,
		taskID,
		title,
		status,
		nullTime(startDate),
		nullTime(deadline),
		orderIndex,
		blocks,
		ownerID,
		stageID,
	)

	return scanTask(row)
}

func (r *Repository) DeleteTask(ctx context.Context, ownerID, taskID uuid.UUID) error {
	result, err := r.db.ExecContext(
		ctx,
		`DELETE FROM stage_tasks t
		 USING project_stages s, projects p
		 LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
		 WHERE t.id = $1
		   AND s.id = t.stage_id
		   AND p.id = s.project_id
		   AND (
			p.owner_id = $2
			OR pm.role IN ('owner', 'manager')
		   )`,
		taskID,
		ownerID,
	)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func scanTask(scanner rowScanner) (Task, error) {
	var (
		task      Task
		startDate sql.NullTime
		deadline  sql.NullTime
		blocks    []byte
		updatedAt time.Time
	)

	err := scanner.Scan(
		&task.ID,
		&task.StageID,
		&task.ProjectID,
		&task.Title,
		&task.Status,
		&startDate,
		&deadline,
		&task.OrderIndex,
		&blocks,
		&updatedAt,
	)
	if err != nil {
		return Task{}, err
	}
	if startDate.Valid {
		task.StartDate = &startDate.Time
	}
	if deadline.Valid {
		task.Deadline = &deadline.Time
	}
	if len(blocks) == 0 {
		blocks = []byte("[]")
	}
	task.Blocks = blocks
	task.UpdatedAt = updatedAt
	return task, nil
}

func nullString(value *string) sql.NullString {
	if value == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *value, Valid: true}
}

func nullTime(value *time.Time) sql.NullTime {
	if value == nil {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: *value, Valid: true}
}

func IsNotFound(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}

func (r *Repository) isProjectMember(ctx context.Context, userID, projectID uuid.UUID) error {
	var exists int
	err := r.db.QueryRowContext(
		ctx,
		`SELECT 1
		 FROM project_members
		 WHERE project_id = $1
		   AND user_id = $2`,
		projectID,
		userID,
	).Scan(&exists)
	if err != nil {
		return err
	}
	return nil
}

func scanDelayReportResponse(scanner rowScanner) (DelayReportResponse, error) {
	var (
		report         DelayReportResponse
		stageIDRaw     sql.NullString
		taskIDRaw      sql.NullString
		authorIDRaw    uuid.UUID
		authorEmailRaw string
	)

	err := scanner.Scan(
		&report.ID,
		&report.ProjectID,
		&report.UserID,
		&stageIDRaw,
		&taskIDRaw,
		&report.Message,
		&report.CreatedAt,
		&authorIDRaw,
		&authorEmailRaw,
	)
	if err != nil {
		return DelayReportResponse{}, err
	}

	if stageIDRaw.Valid {
		parsedStageID, parseErr := uuid.Parse(stageIDRaw.String)
		if parseErr != nil {
			return DelayReportResponse{}, parseErr
		}
		report.StageID = &parsedStageID
	}

	if taskIDRaw.Valid {
		parsedTaskID, parseErr := uuid.Parse(taskIDRaw.String)
		if parseErr != nil {
			return DelayReportResponse{}, parseErr
		}
		report.TaskID = &parsedTaskID
	}

	report.Author = DelayReportAuthor{
		ID:    authorIDRaw,
		Email: authorEmailRaw,
	}

	return report, nil
}

func (r *Repository) CreateDelayReport(ctx context.Context, projectID, userID uuid.UUID, stageID, taskID *uuid.UUID, message string) (DelayReportResponse, error) {
	var stageValue any
	if stageID != nil {
		stageValue = *stageID
	}

	var taskValue any
	if taskID != nil {
		taskValue = *taskID
	}

	row := r.db.QueryRowContext(
		ctx,
		`WITH inserted AS (
		 	INSERT INTO delay_reports (project_id, user_id, stage_id, task_id, message)
		 	SELECT $1, $2, $3, $4, $5
		 	WHERE EXISTS (
		 		SELECT 1
		 		FROM project_members pm
		 		WHERE pm.project_id = $1 AND pm.user_id = $2
		 	)
		 	RETURNING id, project_id, user_id, stage_id, task_id, message, created_at
		 )
		 SELECT dr.id, dr.project_id, dr.user_id, dr.stage_id, dr.task_id, dr.message, dr.created_at, u.id, u.email
		 FROM inserted dr
		 JOIN users u ON u.id = dr.user_id`,
		projectID,
		userID,
		stageValue,
		taskValue,
		message,
	)

	return scanDelayReportResponse(row)
}

func (r *Repository) ListDelayReports(ctx context.Context, requesterID, projectID uuid.UUID) ([]DelayReportResponse, error) {
	if err := r.isProjectMember(ctx, requesterID, projectID); err != nil {
		return nil, err
	}

	rows, err := r.db.QueryContext(
		ctx,
		`SELECT dr.id, dr.project_id, dr.user_id, dr.stage_id, dr.task_id, dr.message, dr.created_at, u.id, u.email
		 FROM delay_reports dr
		 JOIN users u ON u.id = dr.user_id
		 WHERE dr.project_id = $1
		 ORDER BY dr.created_at DESC, dr.id DESC`,
		projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reports := make([]DelayReportResponse, 0)
	for rows.Next() {
		report, scanErr := scanDelayReportResponse(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		reports = append(reports, report)
	}

	return reports, rows.Err()
}

func (r *Repository) ListMembersByProject(ctx context.Context, requesterID, projectID uuid.UUID) ([]ProjectMemberResponse, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`WITH access AS (
			SELECT 1
			FROM projects p
			WHERE p.id = $1
			  AND (
				p.owner_id = $2
				OR EXISTS (
					SELECT 1
					FROM project_members me
					WHERE me.project_id = p.id AND me.user_id = $2
				)
			  )
		), members AS (
			SELECT u.id, u.email, pm.role, pm.created_at
			FROM project_members pm
			JOIN users u ON u.id = pm.user_id
			WHERE pm.project_id = $1
			UNION ALL
			SELECT u_owner.id, u_owner.email, 'owner'::text, p.created_at
			FROM projects p
			JOIN users u_owner ON u_owner.id = p.owner_id
			WHERE p.id = $1
			  AND NOT EXISTS (
				SELECT 1
				FROM project_members pm_owner
				WHERE pm_owner.project_id = p.id
				  AND pm_owner.user_id = p.owner_id
			  )
		)
		SELECT m.id, m.email, m.role
		FROM members m
		WHERE EXISTS (SELECT 1 FROM access)
		ORDER BY m.created_at ASC, m.email ASC`,
		projectID,
		requesterID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	members := make([]ProjectMemberResponse, 0)
	for rows.Next() {
		var member ProjectMemberResponse
		var role string
		if err := rows.Scan(&member.User.ID, &member.User.Email, &role); err != nil {
			return nil, err
		}
		member.Role = ProjectMemberRole(role)
		members = append(members, member)
	}

	return members, rows.Err()
}

func (r *Repository) UpsertMember(ctx context.Context, requesterID, projectID, userID uuid.UUID, role ProjectMemberRole) error {
	if role == ProjectMemberRoleManager {
		return r.DelegateProject(ctx, requesterID, projectID, userID)
	}

	result, err := r.db.ExecContext(
		ctx,
		`INSERT INTO project_members (project_id, user_id, role)
		 SELECT $1, $2, $3
		 WHERE EXISTS (
			SELECT 1
			FROM projects p
			LEFT JOIN project_members me ON me.project_id = p.id AND me.user_id = $4
			WHERE p.id = $1
			  AND (
				p.owner_id = $4
				OR me.role IN ('owner', 'manager')
			  )
		 )
		 ON CONFLICT (project_id, user_id) DO UPDATE
		 SET role = EXCLUDED.role`,
		projectID,
		userID,
		string(role),
		requesterID,
	)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *Repository) UpdateRoles(ctx context.Context, requesterID, projectID, managerID uuid.UUID, memberIDs []uuid.UUID) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var accessGranted int
	if err := tx.QueryRowContext(
		ctx,
		`SELECT 1
		 FROM projects p
		 LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
		 WHERE p.id = $1
		   AND (
			p.owner_id = $2
			OR pm.role IN ('owner', 'manager')
		   )`,
		projectID,
		requesterID,
	).Scan(&accessGranted); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return sql.ErrNoRows
		}
		return err
	}

	var managerCurrentRole string
	err = tx.QueryRowContext(
		ctx,
		`SELECT role
		 FROM project_members
		 WHERE project_id = $1
		   AND user_id = $2`,
		projectID,
		managerID,
	).Scan(&managerCurrentRole)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if err == nil && managerCurrentRole == string(ProjectMemberRoleOwner) {
		return ErrCannotAssignOwnerAsManager
	}

	keepMembers := make(map[uuid.UUID]struct{}, len(memberIDs)+4)
	for _, memberID := range memberIDs {
		if memberID == managerID {
			continue
		}
		keepMembers[memberID] = struct{}{}
	}

	rows, err := tx.QueryContext(
		ctx,
		`SELECT user_id
		 FROM project_members
		 WHERE project_id = $1
		   AND role = 'manager'
		   AND user_id <> $2`,
		projectID,
		managerID,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var previousManagerID uuid.UUID
		if err := rows.Scan(&previousManagerID); err != nil {
			return err
		}
		keepMembers[previousManagerID] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	if _, err := tx.ExecContext(
		ctx,
		`UPDATE project_members
		 SET role = 'member'
		 WHERE project_id = $1
		   AND role = 'manager'
		   AND user_id <> $2`,
		projectID,
		managerID,
	); err != nil {
		return err
	}

	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO project_members (project_id, user_id, role)
		 VALUES ($1, $2, 'manager')
		 ON CONFLICT (project_id, user_id) DO UPDATE
		 SET role = EXCLUDED.role`,
		projectID,
		managerID,
	); err != nil {
		return err
	}

	if _, err := tx.ExecContext(
		ctx,
		`DELETE FROM project_members
		 WHERE project_id = $1
		   AND role = 'member'`,
		projectID,
	); err != nil {
		return err
	}

	for userID := range keepMembers {
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO project_members (project_id, user_id, role)
			 SELECT $1, $2, 'member'
			 WHERE NOT EXISTS (
			 	SELECT 1
			 	FROM project_members
			 	WHERE project_id = $1
			 	  AND user_id = $2
			 	  AND role = 'owner'
			 )
			 ON CONFLICT (project_id, user_id) DO UPDATE
			 SET role = EXCLUDED.role`,
			projectID,
			userID,
		); err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	return nil
}

func (r *Repository) DelegateProject(ctx context.Context, requesterID, projectID, newManagerID uuid.UUID) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var accessGranted int
	if err := tx.QueryRowContext(
		ctx,
		`SELECT 1
		 FROM project_members pm
		 WHERE pm.project_id = $1
		   AND pm.user_id = $2
		   AND pm.role IN ('owner', 'manager')`,
		projectID,
		requesterID,
	).Scan(&accessGranted); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return sql.ErrNoRows
		}
		return err
	}

	var currentRole string
	err = tx.QueryRowContext(
		ctx,
		`SELECT role
		 FROM project_members
		 WHERE project_id = $1
		   AND user_id = $2`,
		projectID,
		newManagerID,
	).Scan(&currentRole)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if err == nil && currentRole == string(ProjectMemberRoleOwner) {
		return ErrCannotAssignOwnerAsManager
	}

	if _, err := tx.ExecContext(
		ctx,
		`UPDATE project_members
		 SET role = 'member'
		 WHERE project_id = $1
		   AND role = 'manager'`,
		projectID,
	); err != nil {
		return err
	}

	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO project_members (project_id, user_id, role)
		 VALUES ($1, $2, 'manager')
		 ON CONFLICT (project_id, user_id) DO UPDATE
		 SET role = EXCLUDED.role`,
		projectID,
		newManagerID,
	); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	return nil
}

func (r *Repository) DeleteMember(ctx context.Context, requesterID, projectID, userID uuid.UUID) error {
	result, err := r.db.ExecContext(
		ctx,
		`DELETE FROM project_members pm
		 WHERE pm.project_id = $1
		   AND pm.user_id = $2
		   AND pm.role <> 'owner'
		   AND EXISTS (
		 	SELECT 1
		 	FROM project_members me
		 	WHERE me.project_id = pm.project_id
		 	  AND me.user_id = $3
		 	  AND me.role IN ('owner', 'manager')
		   )`,
		projectID,
		userID,
		requesterID,
	)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *Repository) CreatePage(ctx context.Context, requesterID, projectID uuid.UUID, title string, blocksJSON []byte) (ProjectPage, error) {
	if len(blocksJSON) == 0 {
		blocksJSON = []byte("[]")
	}

	row := r.db.QueryRowContext(
		ctx,
		`INSERT INTO project_pages (project_id, title, blocks_json, created_by)
		 SELECT $1, $2, $3, $4
		 WHERE EXISTS (
		 	SELECT 1
		 	FROM project_members pm
		 	WHERE pm.project_id = $1
		 	  AND pm.user_id = $4
		 	  AND pm.role IN ('owner', 'manager')
		 )
		 RETURNING id, project_id, title, blocks_json, created_by, created_at, updated_at`,
		projectID,
		title,
		blocksJSON,
		requesterID,
	)

	return scanProjectPage(row)
}

func (r *Repository) ListPagesByProject(ctx context.Context, requesterID, projectID uuid.UUID) ([]ProjectPage, error) {
	if err := r.isProjectMember(ctx, requesterID, projectID); err != nil {
		return nil, err
	}

	rows, err := r.db.QueryContext(
		ctx,
		`SELECT pp.id, pp.project_id, pp.title, pp.blocks_json, pp.created_by, pp.created_at, pp.updated_at
		 FROM project_pages pp
		 WHERE pp.project_id = $1
		 ORDER BY pp.created_at ASC`,
		projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pages := make([]ProjectPage, 0)
	for rows.Next() {
		page, scanErr := scanProjectPage(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		pages = append(pages, page)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return pages, nil
}

func (r *Repository) GetPageByID(ctx context.Context, requesterID, pageID uuid.UUID) (ProjectPage, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT pp.id, pp.project_id, pp.title, pp.blocks_json, pp.created_by, pp.created_at, pp.updated_at
		 FROM project_pages pp
		 WHERE pp.id = $1
		   AND EXISTS (
		 	SELECT 1
		 	FROM project_members pm
		 	WHERE pm.project_id = pp.project_id AND pm.user_id = $2
		   )`,
		pageID,
		requesterID,
	)

	return scanProjectPage(row)
}

func (r *Repository) GetPageByProjectID(ctx context.Context, requesterID, projectID, pageID uuid.UUID) (ProjectPage, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT pp.id, pp.project_id, pp.title, pp.blocks_json, pp.created_by, pp.created_at, pp.updated_at
		 FROM project_pages pp
		 WHERE pp.id = $1
		   AND pp.project_id = $2
		   AND EXISTS (
		 	SELECT 1
		 	FROM project_members pm
		 	WHERE pm.project_id = pp.project_id AND pm.user_id = $3
		   )`,
		pageID,
		projectID,
		requesterID,
	)

	return scanProjectPage(row)
}

func (r *Repository) UpdatePage(ctx context.Context, requesterID, pageID uuid.UUID, title string, blocksJSON []byte) (ProjectPage, error) {
	if len(blocksJSON) == 0 {
		blocksJSON = []byte("[]")
	}

	row := r.db.QueryRowContext(
		ctx,
		`UPDATE project_pages pp
		 SET title = $2,
			 blocks_json = $3,
			 updated_at = now()
		 WHERE pp.id = $1
		   AND EXISTS (
		 	SELECT 1
		 	FROM project_members pm
		 	WHERE pm.project_id = pp.project_id
		 	  AND pm.user_id = $4
		 	  AND pm.role IN ('owner', 'manager')
		   )
		 RETURNING pp.id, pp.project_id, pp.title, pp.blocks_json, pp.created_by, pp.created_at, pp.updated_at`,
		pageID,
		title,
		blocksJSON,
		requesterID,
	)

	return scanProjectPage(row)
}

func (r *Repository) UpdatePageByProjectID(ctx context.Context, requesterID, projectID, pageID uuid.UUID, title string, blocksJSON []byte) (ProjectPage, error) {
	if len(blocksJSON) == 0 {
		blocksJSON = []byte("[]")
	}

	row := r.db.QueryRowContext(
		ctx,
		`UPDATE project_pages pp
		 SET title = $3,
			 blocks_json = $4,
			 updated_at = now()
		 WHERE pp.id = $1
		   AND pp.project_id = $2
		   AND EXISTS (
		 	SELECT 1
		 	FROM project_members pm
		 	WHERE pm.project_id = pp.project_id
		 	  AND pm.user_id = $5
		 	  AND pm.role IN ('owner', 'manager')
		   )
		 RETURNING pp.id, pp.project_id, pp.title, pp.blocks_json, pp.created_by, pp.created_at, pp.updated_at`,
		pageID,
		projectID,
		title,
		blocksJSON,
		requesterID,
	)

	return scanProjectPage(row)
}

func (r *Repository) populateProjectBudget(ctx context.Context, ownerID uuid.UUID, project *Project) error {
	if project == nil {
		return nil
	}

	summary, err := r.GetBudget(ctx, ownerID, project.ID)
	if err != nil {
		return err
	}

	project.SpentBudget = summary.SpentBudget
	project.RemainingBudget = summary.RemainingBudget
	project.ProgressPercent = summary.ProgressPercent
	return nil
}

func (r *Repository) HasEditAccess(ctx context.Context, userID, projectID uuid.UUID) (bool, error) {
	var exists int
	err := r.db.QueryRowContext(
		ctx,
		`SELECT 1
		 FROM project_members
		 WHERE project_id = $1
		   AND user_id = $2
		   AND role IN ('owner', 'manager')`,
		projectID,
		userID,
	).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (r *Repository) populateProjectRole(ctx context.Context, userID uuid.UUID, project *Project) error {
	if project == nil {
		return nil
	}

	var role string
	err := r.db.QueryRowContext(
		ctx,
		`SELECT role
		 FROM project_members
		 WHERE project_id = $1
		   AND user_id = $2`,
		project.ID,
		userID,
	).Scan(&role)
	if err != nil {
		return err
	}

	project.CurrentUserRole = ProjectMemberRole(role)
	return nil
}

func calculateProgressPercent(spentBudget, totalBudget int64) float64 {
	if totalBudget <= 0 {
		return 0
	}
	return (float64(spentBudget) / float64(totalBudget)) * 100
}

func scanExpense(scanner rowScanner) (ProjectExpense, error) {
	var expense ProjectExpense

	err := scanner.Scan(
		&expense.ID,
		&expense.ProjectID,
		&expense.Title,
		&expense.Amount,
		&expense.CreatedBy,
		&expense.CreatedAt,
	)
	if err != nil {
		return ProjectExpense{}, err
	}
	return expense, nil
}

func scanProjectPage(scanner rowScanner) (ProjectPage, error) {
	var page ProjectPage
	var blocks []byte

	err := scanner.Scan(
		&page.ID,
		&page.ProjectID,
		&page.Title,
		&blocks,
		&page.CreatedBy,
		&page.CreatedAt,
		&page.UpdatedAt,
	)
	if err != nil {
		return ProjectPage{}, err
	}

	if len(blocks) == 0 {
		blocks = []byte("[]")
	}
	page.Blocks = blocks
	page.BlocksJSON = blocks
	return page, nil
}
