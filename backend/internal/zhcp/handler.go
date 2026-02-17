package zhcp

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"tm-platform-backend/internal/auth"
	"tm-platform-backend/internal/projects"

	"github.com/google/uuid"
)

type Handler struct {
	client *Client
	repo   *projects.Repository
}

type parsedTaskRef struct {
	PhaseName string
	Task      ParsedTask
}

type createFromContextRequest struct {
	ParsedProject ParsedProject `json:"parsedProject"`
	Budget        *int64        `json:"budget,omitempty"`
}

type createTaskFromContextRequest struct {
	ProjectID     string        `json:"projectId"`
	ParsedProject ParsedProject `json:"parsedProject"`
	Cursor        int           `json:"cursor"`
}

func NewHandler(client *Client, repo *projects.Repository) *Handler {
	return &Handler{client: client, repo: repo}
}

func (h *Handler) Import(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.userIDFromRequest(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	input, filename, err := h.parseDocumentFromMultipart(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	budget := int64(0)
	if rawBudget := strings.TrimSpace(r.FormValue("budget")); rawBudget != "" {
		parsedBudget, parseErr := strconv.ParseInt(rawBudget, 10, 64)
		if parseErr == nil && parsedBudget >= 0 {
			budget = parsedBudget
		}
	}

	project, stagesCreated, tasksCreated, err := h.createProjectFromParsed(r.Context(), userID, input, budget)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"projectId":      project.ID,
		"project":        project.Response(),
		"stagesCreated":  stagesCreated,
		"tasksCreated":   tasksCreated,
		"sourceFileName": filename,
	})
}

func (h *Handler) ParseContext(w http.ResponseWriter, r *http.Request) {
	_, ok := h.userIDFromRequest(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	input, filename, err := h.parseDocumentFromMultipart(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	startDate, deadline := collectProjectDates(input)
	if deadline == nil {
		now := time.Now().UTC()
		fallback := now.AddDate(0, 1, 0)
		deadline = &fallback
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"parsedProject":  input,
		"sourceFileName": filename,
		"summary": map[string]any{
			"title":          strings.TrimSpace(input.Title),
			"stagesCount":    len(input.Phases),
			"tasksCount":     len(flattenParsedTasks(input)),
			"startDate":      startDate,
			"deadline":       deadline,
			"hasDescription": strings.TrimSpace(input.Description) != "",
		},
	})
}

func (h *Handler) CreateProjectFromContext(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.userIDFromRequest(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var req createFromContextRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	budget := int64(0)
	if req.Budget != nil && *req.Budget >= 0 {
		budget = *req.Budget
	}

	project, stagesCreated, tasksCreated, err := h.createProjectFromParsed(r.Context(), userID, req.ParsedProject, budget)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"projectId":     project.ID,
		"project":       project.Response(),
		"stagesCreated": stagesCreated,
		"tasksCreated":  tasksCreated,
	})
}

func (h *Handler) CreateTaskFromContext(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.userIDFromRequest(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var req createTaskFromContextRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	projectID, err := uuid.Parse(strings.TrimSpace(req.ProjectID))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid projectId"})
		return
	}

	if _, err := h.repo.GetByID(r.Context(), userID, projectID); err != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "project is not accessible"})
		return
	}

	flat := flattenParsedTasks(req.ParsedProject)
	if len(flat) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "no tasks in parsed context"})
		return
	}

	cursor := req.Cursor
	if cursor < 0 {
		cursor = 0
	}
	if cursor >= len(flat) {
		cursor = 0
	}

	selected := flat[cursor]
	stageTitle := strings.TrimSpace(selected.PhaseName)
	if stageTitle == "" {
		stageTitle = "Этап из контекста"
	}

	stages, err := h.repo.ListStagesByProject(r.Context(), userID, projectID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list stages"})
		return
	}

	var stage projects.Stage
	stageFound := false
	for _, s := range stages {
		if strings.EqualFold(strings.TrimSpace(s.Title), stageTitle) {
			stage = s
			stageFound = true
			break
		}
	}

	if !stageFound {
		createdStage, createStageErr := h.repo.CreateStage(r.Context(), userID, projectID, stageTitle, len(stages)+1)
		if createStageErr != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create stage"})
			return
		}
		stage = createdStage
	}

	stageTasks, err := h.repo.ListTasksByStage(r.Context(), userID, stage.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list stage tasks"})
		return
	}

	taskTitle := strings.TrimSpace(selected.Task.Name)
	if taskTitle == "" {
		taskTitle = fmt.Sprintf("Задача %d", cursor+1)
	}

	taskStart, _ := parseFlexibleDate(selected.Task.StartDate)
	taskDeadline, _ := parseFlexibleDate(selected.Task.EndDate)
	status := normalizeTaskStatus(selected.Task.Status)

	createdTask, err := h.repo.CreateTask(r.Context(), userID, stage.ID, taskTitle, status, taskStart, taskDeadline, len(stageTasks)+1)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create task"})
		return
	}

	nextCursor := cursor + 1
	if nextCursor >= len(flat) {
		nextCursor = 0
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"taskId":     createdTask.ID,
		"taskTitle":  createdTask.Title,
		"stageId":    stage.ID,
		"stageTitle": stage.Title,
		"nextCursor": nextCursor,
		"projectId":  projectID,
	})
}

func (h *Handler) userIDFromRequest(r *http.Request) (uuid.UUID, bool) {
	userIDStr, ok := auth.UserIDFromContext(r.Context())
	if !ok || strings.TrimSpace(userIDStr) == "" {
		return uuid.Nil, false
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, false
	}
	return userID, true
}

func (h *Handler) parseDocumentFromMultipart(r *http.Request) (ParsedProject, string, error) {
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		return ParsedProject{}, "", fmt.Errorf("invalid multipart payload")
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		return ParsedProject{}, "", fmt.Errorf("file is required")
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".pdf" && ext != ".docx" && ext != ".txt" {
		return ParsedProject{}, "", fmt.Errorf("supported formats: .pdf, .docx, .txt")
	}

	data, err := io.ReadAll(file)
	if err != nil {
		return ParsedProject{}, "", fmt.Errorf("failed to read file")
	}

	parseCtx, cancel := context.WithTimeout(r.Context(), 3*time.Minute)
	defer cancel()

	result, err := h.client.ParseDocument(parseCtx, header.Filename, header.Header.Get("Content-Type"), data)
	if err != nil {
		return ParsedProject{}, "", fmt.Errorf("zhcp parser error: %v", err)
	}

	return result.ProjectStructure.Project, header.Filename, nil
}

func (h *Handler) createProjectFromParsed(ctx context.Context, userID uuid.UUID, input ParsedProject, budget int64) (projects.Project, int, int, error) {

	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = "Новый ЖЦП проект"
	}

	startDate, deadline := collectProjectDates(input)
	if deadline == nil {
		now := time.Now().UTC()
		fallback := now.AddDate(0, 1, 0)
		deadline = &fallback
	}

	var description *string
	if trimmed := strings.TrimSpace(input.Description); trimmed != "" {
		description = &trimmed
	}

	projectID := uuid.New()
	project, err := h.repo.CreateWithID(ctx, userID, projectID, projects.ProjectInput{
		Title:       title,
		Description: description,
		StartDate:   startDate,
		Deadline:    deadline,
		EndDate:     deadline,
		Status:      projects.ProjectStatusActive,
		TotalBudget: budget,
		Blocks:      []byte("[]"),
	})
	if err != nil {
		return projects.Project{}, 0, 0, fmt.Errorf("failed to create project")
	}

	stagesCreated := 0
	tasksCreated := 0

	for i, phase := range input.Phases {
		stageTitle := strings.TrimSpace(phase.Name)
		if stageTitle == "" {
			stageTitle = fmt.Sprintf("Этап %d", i+1)
		}

		stage, createStageErr := h.repo.CreateStage(ctx, userID, project.ID, stageTitle, i+1)
		if createStageErr != nil {
			continue
		}
		stagesCreated++

		for j, task := range phase.Tasks {
			taskTitle := strings.TrimSpace(task.Name)
			if taskTitle == "" {
				taskTitle = fmt.Sprintf("Задача %d", j+1)
			}

			taskStart, _ := parseFlexibleDate(task.StartDate)
			taskDeadline, _ := parseFlexibleDate(task.EndDate)
			status := normalizeTaskStatus(task.Status)
			if _, createTaskErr := h.repo.CreateTask(ctx, userID, stage.ID, taskTitle, status, taskStart, taskDeadline, j+1); createTaskErr == nil {
				tasksCreated++
			}
		}
	}

	return project, stagesCreated, tasksCreated, nil
}

func flattenParsedTasks(project ParsedProject) []parsedTaskRef {
	flat := make([]parsedTaskRef, 0)
	for _, phase := range project.Phases {
		for _, task := range phase.Tasks {
			flat = append(flat, parsedTaskRef{PhaseName: phase.Name, Task: task})
		}
	}
	return flat
}

func collectProjectDates(project ParsedProject) (*time.Time, *time.Time) {
	var start *time.Time
	var deadline *time.Time

	if parsed, ok := parseFlexibleDate(project.Deadline); ok {
		deadline = parsed
	}

	for _, phase := range project.Phases {
		if parsed, ok := parseFlexibleDate(phase.StartDate); ok {
			start = minDate(start, parsed)
		}
		if parsed, ok := parseFlexibleDate(phase.EndDate); ok {
			deadline = maxDate(deadline, parsed)
		}

		for _, task := range phase.Tasks {
			if parsed, ok := parseFlexibleDate(task.StartDate); ok {
				start = minDate(start, parsed)
			}
			if parsed, ok := parseFlexibleDate(task.EndDate); ok {
				deadline = maxDate(deadline, parsed)
			}
		}
	}

	return start, deadline
}

func parseFlexibleDate(raw string) (*time.Time, bool) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil, false
	}

	layouts := []string{"2006-01-02", time.RFC3339, "02.01.2006", "02/01/2006"}
	for _, layout := range layouts {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			normalized := parsed.UTC()
			return &normalized, true
		}
	}

	return nil, false
}

func normalizeTaskStatus(raw string) string {
	value := strings.ToLower(strings.TrimSpace(raw))
	switch value {
	case "done", "completed", "complete", "завершено", "выполнено":
		return "done"
	case "in_progress", "in progress", "progress", "в работе", "выполняется":
		return "in_progress"
	case "delayed", "delay", "просрочено":
		return "delayed"
	default:
		return "planned"
	}
}

func minDate(current, candidate *time.Time) *time.Time {
	if current == nil {
		return candidate
	}
	if candidate.Before(*current) {
		return candidate
	}
	return current
}

func maxDate(current, candidate *time.Time) *time.Time {
	if current == nil {
		return candidate
	}
	if candidate.After(*current) {
		return candidate
	}
	return current
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
