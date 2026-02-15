package projects

import (
	"errors"
	"strings"
	"time"

	"tm-platform-backend/internal/auth"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const userIDContextKey = "userID"

type FiberHandler struct {
	repo    *Repository
	authSvc *auth.Service
}

func NewFiberHandler(repo *Repository, authSvc *auth.Service) *FiberHandler {
	return &FiberHandler{repo: repo, authSvc: authSvc}
}

func (h *FiberHandler) App() *fiber.App {
	app := fiber.New()
	app.Use(h.requireAuth)
	app.Post("/", h.Create)
	app.Get("/", h.List)
	app.Get("/:id", h.GetByID)
	app.Patch("/:id", h.Update)
	app.Put("/:id", h.Update)
	app.Delete("/:id", h.Delete)
	app.Post("/:id/expenses", h.CreateExpense)
	app.Get("/:id/expenses", h.ListExpenses)
	app.Get("/:id/budget", h.GetBudget)
	return app
}

type createProjectRequest struct {
	Title       string         `json:"title"`
	Description *string        `json:"description"`
	CoverURL    *string        `json:"cover_url"`
	StartDate   *time.Time     `json:"start_date"`
	EndDate     *time.Time     `json:"end_date"`
	Status      *ProjectStatus `json:"status"`
	TotalBudget *int64         `json:"total_budget"`
}

type updateProjectRequest struct {
	Title       *string        `json:"title"`
	Description *string        `json:"description"`
	CoverURL    *string        `json:"cover_url"`
	StartDate   *time.Time     `json:"start_date"`
	EndDate     *time.Time     `json:"end_date"`
	Deadline    *time.Time     `json:"deadline"`
	Status      *ProjectStatus `json:"status"`
	TotalBudget *int64         `json:"total_budget"`
	Budget      *int64         `json:"budget"`
}

type createExpenseRequest struct {
	Amount *int64  `json:"amount"`
	Title  *string `json:"title"`
}

func (h *FiberHandler) Create(c *fiber.Ctx) error {
	userID, err := h.userIDFromContext(c)
	if err != nil {
		return fiberError(c, fiber.StatusUnauthorized, err.Error())
	}

	var req createProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return fiberError(c, fiber.StatusBadRequest, "invalid payload")
	}
	if strings.TrimSpace(req.Title) == "" {
		return fiberError(c, fiber.StatusBadRequest, "title is required")
	}
	totalBudget := int64(0)
	if req.TotalBudget != nil {
		totalBudget = *req.TotalBudget
	}
	if totalBudget < 0 {
		return fiberError(c, fiber.StatusBadRequest, "total_budget must be >= 0")
	}

	status := ProjectStatusActive
	if req.Status != nil {
		status = *req.Status
	}
	if !status.Valid() {
		return fiberError(c, fiber.StatusBadRequest, "invalid status")
	}

	if err := validateDates(req.StartDate, req.EndDate); err != nil {
		return fiberError(c, fiber.StatusBadRequest, err.Error())
	}

	project, err := h.repo.Create(c.UserContext(), userID, ProjectInput{
		Title:       strings.TrimSpace(req.Title),
		Description: req.Description,
		CoverURL:    req.CoverURL,
		StartDate:   req.StartDate,
		EndDate:     req.EndDate,
		Status:      status,
		TotalBudget: totalBudget,
	})
	if err != nil {
		return fiberError(c, fiber.StatusInternalServerError, "failed to create project")
	}

	return c.Status(fiber.StatusCreated).JSON(project)
}

func (h *FiberHandler) List(c *fiber.Ctx) error {
	userID, err := h.userIDFromContext(c)
	if err != nil {
		return fiberError(c, fiber.StatusUnauthorized, err.Error())
	}

	projects, err := h.repo.ListByOwner(c.UserContext(), userID)
	if err != nil {
		return fiberError(c, fiber.StatusInternalServerError, "failed to fetch projects")
	}

	return c.JSON(projects)
}

func (h *FiberHandler) GetByID(c *fiber.Ctx) error {
	userID, err := h.userIDFromContext(c)
	if err != nil {
		return fiberError(c, fiber.StatusUnauthorized, err.Error())
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiberError(c, fiber.StatusBadRequest, "invalid project id")
	}

	project, err := h.repo.GetByID(c.UserContext(), userID, projectID)
	if err != nil {
		if IsNotFound(err) {
			return fiberError(c, fiber.StatusNotFound, "project not found")
		}
		return fiberError(c, fiber.StatusInternalServerError, "failed to load project")
	}

	return c.JSON(project)
}

func (h *FiberHandler) Update(c *fiber.Ctx) error {
	userID, err := h.userIDFromContext(c)
	if err != nil {
		return fiberError(c, fiber.StatusUnauthorized, err.Error())
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiberError(c, fiber.StatusBadRequest, "invalid project id")
	}

	var req updateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return fiberError(c, fiber.StatusBadRequest, "invalid payload")
	}
	currentProject, err := h.repo.GetByID(c.UserContext(), userID, projectID)
	if err != nil {
		if IsNotFound(err) {
			return fiberError(c, fiber.StatusNotFound, "project not found")
		}
		return fiberError(c, fiber.StatusInternalServerError, "failed to load project")
	}

	updateInput, err := h.buildProjectUpdateInput(c.Method(), req, currentProject)
	if err != nil {
		return fiberError(c, fiber.StatusBadRequest, err.Error())
	}

	project, err := h.repo.Update(c.UserContext(), userID, projectID, updateInput)
	if err != nil {
		if IsNotFound(err) {
			return fiberError(c, fiber.StatusNotFound, "project not found")
		}
		return fiberError(c, fiber.StatusInternalServerError, "failed to update project")
	}

	return c.JSON(project)
}

func (h *FiberHandler) buildProjectUpdateInput(method string, req updateProjectRequest, current Project) (ProjectInput, error) {
	switch method {
	case fiber.MethodPatch:
		return mergeProjectInput(req, current)
	default:
		return strictProjectInput(req)
	}
}

func strictProjectInput(req updateProjectRequest) (ProjectInput, error) {
	if req.Title == nil || strings.TrimSpace(*req.Title) == "" {
		return ProjectInput{}, errors.New("title is required")
	}
	if req.Status == nil || !req.Status.Valid() {
		return ProjectInput{}, errors.New("invalid status")
	}

	totalBudget := req.TotalBudget
	if totalBudget == nil {
		totalBudget = req.Budget
	}
	if totalBudget == nil {
		return ProjectInput{}, errors.New("total_budget is required")
	}
	if *totalBudget < 0 {
		return ProjectInput{}, errors.New("total_budget must be >= 0")
	}

	endDate := req.EndDate
	if endDate == nil {
		endDate = req.Deadline
	}
	if err := validateDates(req.StartDate, endDate); err != nil {
		return ProjectInput{}, err
	}

	return ProjectInput{
		Title:       strings.TrimSpace(*req.Title),
		Description: req.Description,
		CoverURL:    req.CoverURL,
		StartDate:   req.StartDate,
		EndDate:     endDate,
		Status:      *req.Status,
		TotalBudget: *totalBudget,
	}, nil
}

func mergeProjectInput(req updateProjectRequest, current Project) (ProjectInput, error) {
	title := current.Title
	if req.Title != nil {
		trimmed := strings.TrimSpace(*req.Title)
		if trimmed == "" {
			return ProjectInput{}, errors.New("title is required")
		}
		title = trimmed
	}

	description := current.Description
	if req.Description != nil {
		description = req.Description
	}

	coverURL := current.CoverURL
	if req.CoverURL != nil {
		coverURL = req.CoverURL
	}

	startDate := current.StartDate
	if req.StartDate != nil {
		startDate = req.StartDate
	}

	endDate := current.EndDate
	if req.EndDate != nil {
		endDate = req.EndDate
	}
	if req.Deadline != nil {
		endDate = req.Deadline
	}

	status := current.Status
	if req.Status != nil {
		status = *req.Status
	}
	if !status.Valid() {
		return ProjectInput{}, errors.New("invalid status")
	}

	totalBudget := current.TotalBudget
	if req.TotalBudget != nil {
		totalBudget = *req.TotalBudget
	}
	if req.Budget != nil {
		totalBudget = *req.Budget
	}
	if totalBudget < 0 {
		return ProjectInput{}, errors.New("total_budget must be >= 0")
	}

	if err := validateDates(startDate, endDate); err != nil {
		return ProjectInput{}, err
	}

	return ProjectInput{
		Title:       title,
		Description: description,
		CoverURL:    coverURL,
		StartDate:   startDate,
		EndDate:     endDate,
		Status:      status,
		TotalBudget: totalBudget,
	}, nil
}

func (h *FiberHandler) Delete(c *fiber.Ctx) error {
	userID, err := h.userIDFromContext(c)
	if err != nil {
		return fiberError(c, fiber.StatusUnauthorized, err.Error())
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiberError(c, fiber.StatusBadRequest, "invalid project id")
	}

	if err := h.repo.Delete(c.UserContext(), userID, projectID); err != nil {
		if IsNotFound(err) {
			return fiberError(c, fiber.StatusNotFound, "project not found")
		}
		return fiberError(c, fiber.StatusInternalServerError, "failed to delete project")
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func (h *FiberHandler) CreateExpense(c *fiber.Ctx) error {
	userID, err := h.userIDFromContext(c)
	if err != nil {
		return fiberError(c, fiber.StatusUnauthorized, err.Error())
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiberError(c, fiber.StatusBadRequest, "invalid project id")
	}

	var req createExpenseRequest
	if err := c.BodyParser(&req); err != nil {
		return fiberError(c, fiber.StatusBadRequest, "invalid payload")
	}
	if req.Amount == nil || *req.Amount <= 0 {
		return fiberError(c, fiber.StatusBadRequest, "amount must be > 0")
	}

	title := "Расход"
	if req.Title != nil && strings.TrimSpace(*req.Title) != "" {
		title = strings.TrimSpace(*req.Title)
	}

	expense, err := h.repo.CreateExpense(c.UserContext(), userID, projectID, userID, title, *req.Amount)
	if err != nil {
		if IsNotFound(err) {
			return fiberError(c, fiber.StatusNotFound, "project not found")
		}
		return fiberError(c, fiber.StatusInternalServerError, "failed to create expense")
	}

	return c.Status(fiber.StatusCreated).JSON(expense)
}

func (h *FiberHandler) ListExpenses(c *fiber.Ctx) error {
	userID, err := h.userIDFromContext(c)
	if err != nil {
		return fiberError(c, fiber.StatusUnauthorized, err.Error())
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiberError(c, fiber.StatusBadRequest, "invalid project id")
	}

	expenses, err := h.repo.ListExpenses(c.UserContext(), userID, projectID)
	if err != nil {
		if IsNotFound(err) {
			return fiberError(c, fiber.StatusNotFound, "project not found")
		}
		return fiberError(c, fiber.StatusInternalServerError, "failed to load expenses")
	}

	return c.JSON(expenses)
}

func (h *FiberHandler) GetBudget(c *fiber.Ctx) error {
	userID, err := h.userIDFromContext(c)
	if err != nil {
		return fiberError(c, fiber.StatusUnauthorized, err.Error())
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiberError(c, fiber.StatusBadRequest, "invalid project id")
	}

	summary, err := h.repo.GetBudget(c.UserContext(), userID, projectID)
	if err != nil {
		if IsNotFound(err) {
			return fiberError(c, fiber.StatusNotFound, "project not found")
		}
		return fiberError(c, fiber.StatusInternalServerError, "failed to load budget")
	}

	return c.JSON(summary)
}

func (h *FiberHandler) requireAuth(c *fiber.Ctx) error {
	header := c.Get("Authorization")
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return fiberError(c, fiber.StatusUnauthorized, "missing token")
	}

	token, err := h.authSvc.ParseToken(parts[1])
	if err != nil || !token.Valid {
		return fiberError(c, fiber.StatusUnauthorized, "invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return fiberError(c, fiber.StatusUnauthorized, "invalid token claims")
	}

	userID, ok := claims["sub"].(string)
	if !ok || userID == "" {
		return fiberError(c, fiber.StatusUnauthorized, "invalid token subject")
	}

	c.Locals(userIDContextKey, userID)
	return c.Next()
}

func (h *FiberHandler) userIDFromContext(c *fiber.Ctx) (uuid.UUID, error) {
	value := c.Locals(userIDContextKey)
	userID, ok := value.(string)
	if !ok || userID == "" {
		return uuid.Nil, errors.New("unauthorized")
	}

	parsed, err := uuid.Parse(userID)
	if err != nil {
		return uuid.Nil, errors.New("invalid token subject")
	}

	return parsed, nil
}

func validateDates(start, end *time.Time) error {
	if start != nil && end != nil && end.Before(*start) {
		return errors.New("end_date must be after start_date")
	}
	return nil
}

func fiberError(c *fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(fiber.Map{"error": message})
}
