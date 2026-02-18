package projects

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"tm-platform-backend/internal/auth"
	"tm-platform-backend/internal/notifications"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type updateProjectHTTPReq struct {
	Title                *string         `json:"title"`
	Budget               *int64          `json:"budget"`
	CoverURL             *string         `json:"coverUrl"`
	CoverURLAlt          *string         `json:"cover_url"`
	IconURL              *string         `json:"iconUrl"`
	IconURLAlt           *string         `json:"icon_url"`
	StartDate            *string         `json:"startDate"`
	StartDateAlt         *string         `json:"start_date"`
	Deadline             *string         `json:"deadline"`
	ExpectedUpdatedAt    *string         `json:"expectedUpdatedAt"`
	ExpectedUpdatedAtAlt *string         `json:"expected_updated_at"`
	BlocksJSON           json.RawMessage `json:"blocks_json"`
	Blocks               json.RawMessage `json:"blocks"`
}

func buildProjectUpdateInput(req updateProjectHTTPReq, current Project) (ProjectInput, error) {
	title := current.Title
	if req.Title != nil {
		trimmed := strings.TrimSpace(*req.Title)
		if trimmed == "" {
			return ProjectInput{}, errors.New("title is required")
		}
		title = trimmed
	}

	budget := current.TotalBudget
	if req.Budget != nil {
		budget = *req.Budget
	}
	if budget < 0 {
		return ProjectInput{}, errors.New("budget must be >= 0")
	}

	coverURL := current.CoverURL
	if req.CoverURL != nil || req.CoverURLAlt != nil {
		value := firstNonNilString(req.CoverURL, req.CoverURLAlt)
		coverURL = normalizeOptionalStringPtr(value)
	}

	iconURL := current.IconURL
	if req.IconURL != nil || req.IconURLAlt != nil {
		value := firstNonNilString(req.IconURL, req.IconURLAlt)
		iconURL = normalizeOptionalStringPtr(value)
	}

	startDate := current.StartDate
	if req.StartDate != nil || req.StartDateAlt != nil {
		value := firstNonNilString(req.StartDate, req.StartDateAlt)
		parsed, err := parseDateString(derefOrEmpty(value))
		if err != nil {
			return ProjectInput{}, errors.New("invalid startDate")
		}
		startDate = parsed
	}

	currentDeadline := current.Deadline
	if currentDeadline == nil {
		currentDeadline = current.EndDate
	}
	deadline := currentDeadline
	if req.Deadline != nil {
		parsed, err := parseDateString(derefOrEmpty(req.Deadline))
		if err != nil {
			return ProjectInput{}, errors.New("invalid deadline")
		}
		deadline = parsed
	}

	blocks := current.Blocks
	if req.Blocks != nil {
		blocks = req.Blocks
		if len(blocks) == 0 || string(blocks) == "null" {
			blocks = json.RawMessage("[]")
		}
	}

	return ProjectInput{
		Title:       title,
		Description: current.Description,
		CoverURL:    coverURL,
		IconURL:     iconURL,
		StartDate:   startDate,
		Deadline:    deadline,
		EndDate:     deadline,
		Status:      current.Status,
		TotalBudget: budget,
		Blocks:      blocks,
	}, nil
}

func normalizeOptionalStringPtr(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func firstNonNilString(values ...*string) *string {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func derefOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

type HTTPHandler struct {
	repo              *Repository
	notificationsRepo *notifications.Repository
}

func NewHTTPHandler(repo *Repository, notificationsRepo *notifications.Repository) *HTTPHandler {
	return &HTTPHandler{repo: repo, notificationsRepo: notificationsRepo}
}

func (h *HTTPHandler) notifyUsers(ctx context.Context, userIDs []uuid.UUID, actorID uuid.UUID, kind notifications.Kind, title, body, link, entityType string, entityID *uuid.UUID) {
	if h.notificationsRepo == nil {
		return
	}

	seen := make(map[uuid.UUID]struct{}, len(userIDs))
	for _, userID := range userIDs {
		if userID == uuid.Nil || userID == actorID {
			continue
		}
		if _, ok := seen[userID]; ok {
			continue
		}
		seen[userID] = struct{}{}

		var actor *uuid.UUID
		if actorID != uuid.Nil {
			actor = &actorID
		}
		if err := h.notificationsRepo.Create(ctx, userID, actor, kind, title, body, link, entityType, entityID); err != nil {
			log.Printf("notification create failed: %v", err)
		}
	}
}

func (h *HTTPHandler) resolveAssigneeUserIDs(members []ProjectMemberResponse, assignees map[string]struct{}) []uuid.UUID {
	if len(assignees) == 0 || len(members) == 0 {
		return nil
	}

	ids := make([]uuid.UUID, 0)
	for _, member := range members {
		idRef := strings.ToLower(strings.TrimSpace(member.User.ID.String()))
		emailRef := strings.ToLower(strings.TrimSpace(member.User.Email))
		if _, ok := assignees[idRef]; ok {
			ids = append(ids, member.User.ID)
			continue
		}
		if emailRef != "" {
			if _, ok := assignees[emailRef]; ok {
				ids = append(ids, member.User.ID)
			}
		}
	}

	return ids
}

func roleTitle(role ProjectMemberRole) string {
	switch role {
	case ProjectMemberRoleOwner:
		return "Владелец"
	case ProjectMemberRoleManager:
		return "Менеджер"
	default:
		return "Участник"
	}
}

func (h *HTTPHandler) RequireEditAccess(projectIDParam string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, err := userIDFromRequest(r)
			if err != nil {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
				return
			}

			projectID, err := uuid.Parse(chi.URLParam(r, projectIDParam))
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
				return
			}

			allowed, err := h.repo.HasEditAccess(r.Context(), userID, projectID)
			if err != nil {
				log.Printf("RequireEditAccess failed: %v", err)
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to validate access"})
				return
			}
			if !allowed {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

type CreateProjectRequest struct {
	Title        string          `json:"title"`
	Budget       int64           `json:"budget"`
	StartDate    string          `json:"startDate"`
	StartDateAlt string          `json:"start_date"`
	Deadline     string          `json:"deadline"`
	CoverUrl     string          `json:"coverUrl"`
	CoverUrlAlt  string          `json:"cover_url"`
	IconUrl      string          `json:"iconUrl"`
	IconUrlAlt   string          `json:"icon_url"`
	Blocks       json.RawMessage `json:"blocks"`
}

type createStageRequest struct {
	Title      string `json:"title"`
	OrderIndex *int   `json:"order_index"`
}

type updateStageRequest struct {
	Title      *string `json:"title"`
	OrderIndex *int    `json:"order_index"`
}

type createTaskRequest struct {
	Title        string  `json:"title"`
	Status       string  `json:"status"`
	StartDate    *string `json:"startDate"`
	StartDateAlt *string `json:"start_date"`
	Deadline     *string `json:"deadline"`
	OrderIndex   *int    `json:"order_index"`
}

type updateTaskRequest struct {
	Title                *string         `json:"title"`
	Status               *string         `json:"status"`
	StartDate            *string         `json:"startDate"`
	StartDateAlt         *string         `json:"start_date"`
	Deadline             *string         `json:"deadline"`
	StageID              *string         `json:"stageId"`
	StageIDAlt           *string         `json:"stage_id"`
	OrderIndex           *int            `json:"order_index"`
	ExpectedUpdatedAt    *string         `json:"expectedUpdatedAt"`
	ExpectedUpdatedAtAlt *string         `json:"expected_updated_at"`
	Blocks               json.RawMessage `json:"blocks"`
}

type createExpenseHTTPReq struct {
	Title  *string `json:"title"`
	Amount *int64  `json:"amount"`
}

type upsertProjectMemberReq struct {
	UserID *string `json:"userId"`
	Role   *string `json:"role"`
}

type updateProjectRolesReq struct {
	ManagerID    *string  `json:"managerId"`
	ManagerIDAlt *string  `json:"manager_id"`
	MemberIDs    []string `json:"memberIds"`
	MemberIDsAlt []string `json:"member_ids"`
}

type createProjectPageReq struct {
	Title      *string         `json:"title"`
	BlocksJSON json.RawMessage `json:"blocks_json"`
	Blocks     json.RawMessage `json:"blocks"`
}

type createDelayReportReq struct {
	StageID    *string `json:"stageId"`
	StageIDAlt *string `json:"stage_id"`
	TaskID     *string `json:"taskId"`
	TaskIDAlt  *string `json:"task_id"`
	Message    *string `json:"message"`
}

type createTaskCommentReq struct {
	Message *string `json:"message"`
}

type updateProjectPageReq struct {
	Title      *string         `json:"title"`
	BlocksJSON json.RawMessage `json:"blocks_json"`
	Blocks     json.RawMessage `json:"blocks"`
}

func normalizePageBlocks(blocksJSON, blocks json.RawMessage) json.RawMessage {
	normalized := blocks
	if len(normalized) == 0 || string(normalized) == "null" {
		normalized = blocksJSON
	}
	if len(normalized) == 0 || string(normalized) == "null" {
		normalized = json.RawMessage("[]")
	}
	return normalized
}

func (h *HTTPHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	log.Println("CreateProject called")

	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	var req CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	if strings.TrimSpace(req.Title) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required"})
		return
	}

	startDate, err := parseDateString(req.StartDate)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid startDate"})
		return
	}
	if startDate == nil && strings.TrimSpace(req.StartDateAlt) != "" {
		startDate, err = parseDateString(req.StartDateAlt)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid startDate"})
			return
		}
	}

	deadline, err := parseDateString(req.Deadline)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid deadline"})
		return
	}

	coverValue := strings.TrimSpace(req.CoverUrl)
	if coverValue == "" {
		coverValue = strings.TrimSpace(req.CoverUrlAlt)
	}
	var coverURL *string
	if coverValue != "" {
		coverURL = &coverValue
	}

	iconValue := strings.TrimSpace(req.IconUrl)
	if iconValue == "" {
		iconValue = strings.TrimSpace(req.IconUrlAlt)
	}
	var iconURL *string
	if iconValue != "" {
		iconURL = &iconValue
	}

	blocks := req.Blocks
	if len(blocks) == 0 || string(blocks) == "null" {
		blocks = json.RawMessage("[]")
	}

	projectID := uuid.New()
	project, err := h.repo.CreateWithID(r.Context(), userID, projectID, ProjectInput{
		Title:       strings.TrimSpace(req.Title),
		CoverURL:    coverURL,
		IconURL:     iconURL,
		StartDate:   startDate,
		Deadline:    deadline,
		EndDate:     deadline,
		Status:      ProjectStatusActive,
		TotalBudget: req.Budget,
		Blocks:      blocks,
	})
	if err != nil {
		log.Printf("CreateProject failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create project"})
		return
	}

	h.notifyUsers(
		r.Context(),
		[]uuid.UUID{userID},
		uuid.Nil,
		notifications.KindProjectCreated,
		"Проект создан",
		"Вы успешно создали новый проект: "+project.Title,
		"/project-overview/"+project.ID.String(),
		"project",
		&project.ID,
	)

	writeJSON(w, http.StatusCreated, project.Response())
}

func (h *HTTPHandler) ListProjects(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	projects, err := h.repo.ListByOwner(r.Context(), userID)
	if err != nil {
		log.Printf("ListProjects failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch projects"})
		return
	}

	responses := make([]ProjectResponse, 0, len(projects))
	for _, project := range projects {
		responses = append(responses, project.Response())
	}

	writeJSON(w, http.StatusOK, responses)
}

func (h *HTTPHandler) GetProject(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	projectID, err := uuid.Parse(id)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	project, err := h.repo.GetByID(r.Context(), userID, projectID)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "project not found"})
			return
		}
		log.Printf("GetProject failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load project"})
		return
	}

	writeJSON(w, http.StatusOK, project.Response())
}

func (h *HTTPHandler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	projectID, err := uuid.Parse(id)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	var req updateProjectHTTPReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	if req.BlocksJSON != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "page updates must use PATCH /projects/:projectId/pages/:pageId"})
		return
	}

	currentProject, err := h.repo.GetByID(r.Context(), userID, projectID)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "project not found"})
			return
		}
		log.Printf("UpdateProject load failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load project"})
		return
	}

	expectedUpdatedAt, err := parseExpectedUpdatedAt(req.ExpectedUpdatedAt, req.ExpectedUpdatedAtAlt)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if expectedUpdatedAt != nil && !currentProject.UpdatedAt.UTC().Equal(expectedUpdatedAt.UTC()) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "данные проекта изменились в другой вкладке, обновите страницу"})
		return
	}

	updateInput, err := buildProjectUpdateInput(req, currentProject)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	project, err := h.repo.Update(r.Context(), userID, projectID, updateInput)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "project not found"})
			return
		}
		log.Printf("UpdateProject failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update project"})
		return
	}

	writeJSON(w, http.StatusOK, project.Response())
}

func (h *HTTPHandler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	projectID, err := uuid.Parse(id)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	if err := h.repo.Delete(r.Context(), userID, projectID); err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "project not found"})
			return
		}
		log.Printf("DeleteProject failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete project"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *HTTPHandler) CreatePage(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	var req createProjectPageReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	title := "Новая страница"
	if req.Title != nil && strings.TrimSpace(*req.Title) != "" {
		title = strings.TrimSpace(*req.Title)
	}

	blocks := normalizePageBlocks(req.BlocksJSON, req.Blocks)

	page, err := h.repo.CreatePage(r.Context(), userID, projectID, title, blocks)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "project not found or forbidden"})
			return
		}
		log.Printf("CreatePage failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create page"})
		return
	}

	writeJSON(w, http.StatusCreated, page)
}

func (h *HTTPHandler) ListPages(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	pages, err := h.repo.ListPagesByProject(r.Context(), userID, projectID)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "project not found or forbidden"})
			return
		}
		log.Printf("ListPages failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list pages"})
		return
	}

	writeJSON(w, http.StatusOK, pages)
}

func (h *HTTPHandler) GetPage(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	pageID, err := uuid.Parse(chi.URLParam(r, "pageId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid page id"})
		return
	}

	page, err := h.repo.GetPageByProjectID(r.Context(), userID, projectID, pageID)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "page not found"})
			return
		}
		log.Printf("GetPage failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load page"})
		return
	}

	writeJSON(w, http.StatusOK, page)
}

func (h *HTTPHandler) UpdatePage(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	pageID, err := uuid.Parse(chi.URLParam(r, "pageId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid page id"})
		return
	}

	var req updateProjectPageReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	title := "Новая страница"
	if req.Title != nil && strings.TrimSpace(*req.Title) != "" {
		title = strings.TrimSpace(*req.Title)
	}

	blocks := normalizePageBlocks(req.BlocksJSON, req.Blocks)

	page, err := h.repo.UpdatePageByProjectID(r.Context(), userID, projectID, pageID, title, blocks)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "page not found or forbidden"})
			return
		}
		log.Printf("UpdatePage failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update page"})
		return
	}

	writeJSON(w, http.StatusOK, page)
}

func (h *HTTPHandler) CreateExpense(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	var req createExpenseHTTPReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	if req.Amount == nil || *req.Amount <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "amount must be > 0"})
		return
	}

	title := "Расход"
	if req.Title != nil && strings.TrimSpace(*req.Title) != "" {
		title = strings.TrimSpace(*req.Title)
	}

	expense, err := h.repo.CreateExpense(r.Context(), userID, projectID, userID, title, *req.Amount)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "project not found"})
			return
		}
		log.Printf("CreateExpense failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create expense"})
		return
	}

	writeJSON(w, http.StatusCreated, expense)
}

func (h *HTTPHandler) ListExpenses(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	expenses, err := h.repo.ListExpenses(r.Context(), userID, projectID)
	if err != nil {
		log.Printf("ListExpenses failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch expenses"})
		return
	}

	writeJSON(w, http.StatusOK, expenses)
}

func (h *HTTPHandler) CreateDelayReport(w http.ResponseWriter, r *http.Request) {
	requesterID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	var req createDelayReportReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	if req.Message == nil || strings.TrimSpace(*req.Message) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message is required"})
		return
	}

	message := strings.TrimSpace(*req.Message)

	var stageID *uuid.UUID
	stageIDRaw := firstNonNilString(req.StageID, req.StageIDAlt)
	if stageIDRaw != nil && strings.TrimSpace(*stageIDRaw) != "" {
		parsedStageID, parseErr := uuid.Parse(strings.TrimSpace(*stageIDRaw))
		if parseErr != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid stage id"})
			return
		}
		stageID = &parsedStageID
	}

	var taskID *uuid.UUID
	taskIDRaw := firstNonNilString(req.TaskID, req.TaskIDAlt)
	if taskIDRaw != nil && strings.TrimSpace(*taskIDRaw) != "" {
		parsedTaskID, parseErr := uuid.Parse(strings.TrimSpace(*taskIDRaw))
		if parseErr != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid task id"})
			return
		}
		taskID = &parsedTaskID
	}

	if taskID != nil {
		canWrite, checkErr := h.repo.CanWriteTaskDiscussion(r.Context(), requesterID, *taskID)
		if checkErr != nil {
			if IsNotFound(checkErr) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "task not found"})
				return
			}
			log.Printf("CreateDelayReport permission check failed: %v", checkErr)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to validate permissions"})
			return
		}
		if !canWrite {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
	}

	report, err := h.repo.CreateDelayReport(r.Context(), projectID, requesterID, stageID, taskID, message)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		log.Printf("CreateDelayReport failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create delay report"})
		return
	}

	writeJSON(w, http.StatusCreated, report)
}

func (h *HTTPHandler) CreateTaskComment(w http.ResponseWriter, r *http.Request) {
	requesterID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid task id"})
		return
	}

	var req createTaskCommentReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	if req.Message == nil || strings.TrimSpace(*req.Message) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message is required"})
		return
	}

	comment, err := h.repo.CreateTaskComment(r.Context(), requesterID, taskID, strings.TrimSpace(*req.Message))
	if err != nil {
		if errors.Is(err, ErrTaskCommentForbidden) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "task not found"})
			return
		}
		log.Printf("CreateTaskComment failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create comment"})
		return
	}

	members, membersErr := h.repo.ListMembersByProject(r.Context(), requesterID, comment.ProjectID)
	if membersErr == nil {
		targets := make([]uuid.UUID, 0, len(members))
		for _, member := range members {
			targets = append(targets, member.User.ID)
		}
		h.notifyUsers(
			r.Context(),
			targets,
			requesterID,
			notifications.KindTaskComment,
			"Новый комментарий в задаче",
			"В задаче появился новый комментарий",
			"/project/task-"+comment.TaskID.String(),
			"task",
			&comment.TaskID,
		)
	}

	writeJSON(w, http.StatusCreated, comment)
}

func (h *HTTPHandler) ListTaskComments(w http.ResponseWriter, r *http.Request) {
	requesterID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid task id"})
		return
	}

	comments, err := h.repo.ListTaskComments(r.Context(), requesterID, taskID)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		log.Printf("ListTaskComments failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch comments"})
		return
	}

	writeJSON(w, http.StatusOK, comments)
}

func (h *HTTPHandler) ListTaskHistory(w http.ResponseWriter, r *http.Request) {
	requesterID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid task id"})
		return
	}

	history, err := h.repo.ListTaskHistory(r.Context(), requesterID, taskID)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		log.Printf("ListTaskHistory failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch history"})
		return
	}

	writeJSON(w, http.StatusOK, history)
}

func (h *HTTPHandler) ListDelayReports(w http.ResponseWriter, r *http.Request) {
	requesterID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	reports, err := h.repo.ListDelayReports(r.Context(), requesterID, projectID)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		log.Printf("ListDelayReports failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch delay reports"})
		return
	}

	writeJSON(w, http.StatusOK, reports)
}

func (h *HTTPHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	requesterID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	members, err := h.repo.ListMembersByProject(r.Context(), requesterID, projectID)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		log.Printf("ListMembers failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch members"})
		return
	}

	writeJSON(w, http.StatusOK, members)
}

func (h *HTTPHandler) UpdateRoles(w http.ResponseWriter, r *http.Request) {
	requesterID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	var req updateProjectRolesReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	managerIDRaw := firstNonNilString(req.ManagerID, req.ManagerIDAlt)
	if managerIDRaw == nil || strings.TrimSpace(*managerIDRaw) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "managerId is required"})
		return
	}

	managerID, err := uuid.Parse(strings.TrimSpace(*managerIDRaw))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid manager id"})
		return
	}

	memberIDsRaw := req.MemberIDs
	if len(memberIDsRaw) == 0 && len(req.MemberIDsAlt) > 0 {
		memberIDsRaw = req.MemberIDsAlt
	}

	memberIDs := make([]uuid.UUID, 0, len(memberIDsRaw))
	seen := make(map[uuid.UUID]struct{}, len(memberIDsRaw))
	for _, memberIDRaw := range memberIDsRaw {
		trimmed := strings.TrimSpace(memberIDRaw)
		if trimmed == "" {
			continue
		}
		memberID, parseErr := uuid.Parse(trimmed)
		if parseErr != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid member id"})
			return
		}
		if _, exists := seen[memberID]; exists {
			continue
		}
		seen[memberID] = struct{}{}
		memberIDs = append(memberIDs, memberID)
	}

	if err := h.repo.UpdateRoles(r.Context(), requesterID, projectID, managerID, memberIDs); err != nil {
		if errors.Is(err, ErrCannotAssignOwnerAsManager) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "owner cannot be assigned as manager"})
			return
		}
		if IsNotFound(err) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		log.Printf("UpdateRoles failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update roles"})
		return
	}

	projectTitle := ""
	if projectItem, getErr := h.repo.GetByID(r.Context(), requesterID, projectID); getErr == nil {
		projectTitle = strings.TrimSpace(projectItem.Title)
	}
	projectTitlePart := ""
	if projectTitle != "" {
		projectTitlePart = " в проекте «" + projectTitle + "»"
	}

	h.notifyUsers(
		r.Context(),
		[]uuid.UUID{managerID},
		requesterID,
		notifications.KindProjectMember,
		"Обновлены роли в проекте",
		"Вам назначена роль: "+roleTitle(ProjectMemberRoleManager)+projectTitlePart,
		"/project-overview/"+projectID.String(),
		"project",
		&projectID,
	)

	memberTargets := make([]uuid.UUID, 0, len(memberIDs))
	for _, memberID := range memberIDs {
		if memberID == managerID {
			continue
		}
		memberTargets = append(memberTargets, memberID)
	}
	h.notifyUsers(
		r.Context(),
		memberTargets,
		requesterID,
		notifications.KindProjectMember,
		"Обновлены роли в проекте",
		"Вам назначена роль: "+roleTitle(ProjectMemberRoleMember)+projectTitlePart,
		"/project-overview/"+projectID.String(),
		"project",
		&projectID,
	)

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *HTTPHandler) UpsertMember(w http.ResponseWriter, r *http.Request) {
	requesterID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	var req upsertProjectMemberReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	if req.UserID == nil || strings.TrimSpace(*req.UserID) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "userId is required"})
		return
	}

	memberUserID, err := uuid.Parse(strings.TrimSpace(*req.UserID))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user id"})
		return
	}

	if req.Role == nil || strings.TrimSpace(*req.Role) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "role is required"})
		return
	}

	role := ProjectMemberRole(strings.ToLower(strings.TrimSpace(*req.Role)))
	if !role.Valid() {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid role"})
		return
	}

	if err := h.repo.UpsertMember(r.Context(), requesterID, projectID, memberUserID, role); err != nil {
		if errors.Is(err, ErrCannotAssignOwnerAsManager) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "owner cannot be assigned as manager"})
			return
		}
		if IsNotFound(err) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		log.Printf("UpsertMember failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save member"})
		return
	}

	h.notifyUsers(
		r.Context(),
		[]uuid.UUID{memberUserID},
		requesterID,
		notifications.KindProjectMember,
		"Вы добавлены в проект",
		"Вам назначена роль: "+roleTitle(role),
		"/project-overview/"+projectID.String(),
		"project",
		&projectID,
	)

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *HTTPHandler) DeleteMember(w http.ResponseWriter, r *http.Request) {
	requesterID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	memberUserID, err := uuid.Parse(chi.URLParam(r, "userId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user id"})
		return
	}

	if err := h.repo.DeleteMember(r.Context(), requesterID, projectID, memberUserID); err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "member not found or forbidden"})
			return
		}
		log.Printf("DeleteMember failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete member"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *HTTPHandler) DeleteExpense(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	expenseID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid expense id"})
		return
	}

	if err := h.repo.DeleteExpense(r.Context(), userID, expenseID); err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "expense not found"})
			return
		}
		log.Printf("DeleteExpense failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete expense"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *HTTPHandler) CreateStage(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	var req createStageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required"})
		return
	}

	orderIndex := 0
	if req.OrderIndex != nil {
		orderIndex = *req.OrderIndex
	}

	stage, err := h.repo.CreateStage(r.Context(), userID, projectID, title, orderIndex)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "project not found"})
			return
		}
		log.Printf("CreateStage failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create stage"})
		return
	}

	writeJSON(w, http.StatusCreated, stage)
}

func (h *HTTPHandler) ListStages(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	stages, err := h.repo.ListStagesByProject(r.Context(), userID, projectID)
	if err != nil {
		log.Printf("ListStages failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch stages"})
		return
	}

	writeJSON(w, http.StatusOK, stages)
}

func (h *HTTPHandler) UpdateStage(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	stageID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid stage id"})
		return
	}

	var req updateStageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	title := ""
	if req.Title != nil {
		title = strings.TrimSpace(*req.Title)
	}
	if title == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required"})
		return
	}

	orderIndex := 0
	if req.OrderIndex != nil {
		orderIndex = *req.OrderIndex
	}

	stage, err := h.repo.UpdateStage(r.Context(), userID, stageID, title, orderIndex)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "stage not found"})
			return
		}
		log.Printf("UpdateStage failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update stage"})
		return
	}

	writeJSON(w, http.StatusOK, stage)
}

func (h *HTTPHandler) DeleteStage(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	stageID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid stage id"})
		return
	}

	if err := h.repo.DeleteStage(r.Context(), userID, stageID); err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "stage not found"})
			return
		}
		log.Printf("DeleteStage failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete stage"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *HTTPHandler) DeleteStageInProject(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project id"})
		return
	}

	stageID, err := uuid.Parse(chi.URLParam(r, "stageId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid stage id"})
		return
	}

	if err := h.repo.DeleteStageByProject(r.Context(), userID, projectID, stageID); err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "stage not found"})
			return
		}
		log.Printf("DeleteStageInProject failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete stage"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *HTTPHandler) CreateTask(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	stageID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid stage id"})
		return
	}

	var req createTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "Новая задача"
	}
	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "todo"
	}

	startDateRaw := firstNonNilString(req.StartDate, req.StartDateAlt)
	startDate, err := parseOptionalDate(startDateRaw)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid startDate"})
		return
	}

	deadline, err := parseOptionalDate(req.Deadline)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid deadline"})
		return
	}

	orderIndex := 0
	if req.OrderIndex != nil {
		orderIndex = *req.OrderIndex
	}

	task, err := h.repo.CreateTask(r.Context(), userID, stageID, title, status, startDate, deadline, orderIndex)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "stage not found"})
			return
		}
		log.Printf("CreateTask failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create task"})
		return
	}

	writeJSON(w, http.StatusCreated, task)
}

func (h *HTTPHandler) GetTask(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid task id"})
		return
	}

	task, err := h.repo.GetTaskByID(r.Context(), userID, taskID)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "task not found"})
			return
		}
		log.Printf("GetTask failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load task"})
		return
	}

	writeJSON(w, http.StatusOK, task)
}

func (h *HTTPHandler) ListTasks(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	stageID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid stage id"})
		return
	}

	tasks, err := h.repo.ListTasksByStage(r.Context(), userID, stageID)
	if err != nil {
		log.Printf("ListTasks failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch tasks"})
		return
	}

	writeJSON(w, http.StatusOK, tasks)
}

func (h *HTTPHandler) UpdateTask(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid task id"})
		return
	}

	var req updateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	currentTask, err := h.repo.GetTaskByID(r.Context(), userID, taskID)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "task not found"})
			return
		}
		log.Printf("UpdateTask load failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load task"})
		return
	}

	expectedUpdatedAt, err := parseExpectedUpdatedAt(req.ExpectedUpdatedAt, req.ExpectedUpdatedAtAlt)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if expectedUpdatedAt != nil && !currentTask.UpdatedAt.UTC().Equal(expectedUpdatedAt.UTC()) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "данные задачи изменились в другой вкладке, обновите страницу"})
		return
	}

	title := ""
	if req.Title != nil {
		title = strings.TrimSpace(*req.Title)
	}
	if title == "" {
		title = "Новая задача"
	}

	status := "todo"
	if req.Status != nil && strings.TrimSpace(*req.Status) != "" {
		status = strings.TrimSpace(*req.Status)
	}

	startDateRaw := firstNonNilString(req.StartDate, req.StartDateAlt)
	startDate, err := parseOptionalDate(startDateRaw)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid startDate"})
		return
	}

	deadline, err := parseOptionalDate(req.Deadline)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid deadline"})
		return
	}

	orderIndex := 0
	if req.OrderIndex != nil {
		orderIndex = *req.OrderIndex
	}

	var stageID *uuid.UUID
	stageIDRaw := firstNonNilString(req.StageID, req.StageIDAlt)
	if stageIDRaw != nil && strings.TrimSpace(*stageIDRaw) != "" {
		parsedStageID, parseErr := uuid.Parse(strings.TrimSpace(*stageIDRaw))
		if parseErr != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid stage id"})
			return
		}
		stageID = &parsedStageID
	}

	blocks := req.Blocks
	if len(blocks) == 0 || string(blocks) == "null" {
		blocks = json.RawMessage("[]")
	}
	oldAssignees := assigneesFromBlocks(currentTask.Blocks)
	newAssignees := assigneesFromBlocks(blocks)

	task, err := h.repo.UpdateTask(r.Context(), userID, taskID, title, status, startDate, deadline, stageID, orderIndex, blocks)
	if err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "task not found"})
			return
		}
		log.Printf("UpdateTask failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update task"})
		return
	}

	if len(newAssignees) > 0 {
		addedAssignees := make(map[string]struct{}, len(newAssignees))
		for value := range newAssignees {
			if _, already := oldAssignees[value]; !already {
				addedAssignees[value] = struct{}{}
			}
		}

		if len(addedAssignees) > 0 {
			members, membersErr := h.repo.ListMembersByProject(r.Context(), userID, task.ProjectID)
			if membersErr == nil {
				targetIDs := h.resolveAssigneeUserIDs(members, addedAssignees)
				h.notifyUsers(
					r.Context(),
					targetIDs,
					userID,
					notifications.KindTaskDelegated,
					"Вам делегирована задача",
					"Вам назначена задача: "+task.Title,
					"/project/task-"+task.ID.String(),
					"task",
					&task.ID,
				)
			}
		}
	}

	writeJSON(w, http.StatusOK, task)
}

func (h *HTTPHandler) DeleteTask(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid task id"})
		return
	}

	if err := h.repo.DeleteTask(r.Context(), userID, taskID); err != nil {
		if IsNotFound(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "task not found"})
			return
		}
		log.Printf("DeleteTask failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete task"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func userIDFromRequest(r *http.Request) (uuid.UUID, error) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		return uuid.Nil, errors.New("unauthorized")
	}

	parsed, err := uuid.Parse(userID)
	if err != nil {
		return uuid.Nil, errors.New("invalid token subject")
	}

	return parsed, nil
}

func parseDateString(value string) (*time.Time, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, nil
	}

	if parsed, err := time.Parse(time.RFC3339, trimmed); err == nil {
		return &parsed, nil
	}

	if parsed, err := time.Parse("2006-01-02", trimmed); err == nil {
		return &parsed, nil
	}

	return nil, errors.New("invalid date")
}

func parseOptionalDate(value *string) (*time.Time, error) {
	if value == nil {
		return nil, nil
	}
	return parseDateString(*value)
}

func parseExpectedUpdatedAt(values ...*string) (*time.Time, error) {
	value := firstNonNilString(values...)
	if value == nil {
		return nil, nil
	}

	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil, nil
	}

	if parsed, err := time.Parse(time.RFC3339Nano, trimmed); err == nil {
		return &parsed, nil
	}
	if parsed, err := time.Parse(time.RFC3339, trimmed); err == nil {
		return &parsed, nil
	}

	return nil, errors.New("invalid expected_updated_at")
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
