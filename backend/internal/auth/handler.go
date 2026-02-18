package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

type Handler struct {
	repo *Repository
	svc  *Service
}

func NewHandler(repo *Repository, svc *Service) *Handler {
	return &Handler{repo: repo, svc: svc}
}

type authRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type authResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

type userResponse struct {
	ID             uuid.UUID  `json:"id"`
	FullName       *string    `json:"full_name,omitempty"`
	AvatarURL      *string    `json:"avatar_url,omitempty"`
	Email          string     `json:"email"`
	Role           *string    `json:"role"`
	ManagerID      *uuid.UUID `json:"manager_id,omitempty"`
	DepartmentID   *uuid.UUID `json:"department_id,omitempty"`
	DepartmentName *string    `json:"department_name,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type hierarchyNode struct {
	ID             uuid.UUID        `json:"id"`
	FullName       *string          `json:"full_name,omitempty"`
	AvatarURL      *string          `json:"avatar_url,omitempty"`
	Email          string           `json:"email"`
	Role           *string          `json:"role"`
	ManagerID      *uuid.UUID       `json:"manager_id,omitempty"`
	DepartmentID   *uuid.UUID       `json:"department_id,omitempty"`
	DepartmentName *string          `json:"department_name,omitempty"`
	Subordinates   []*hierarchyNode `json:"subordinates,omitempty"`
}

type departmentResponse struct {
	ID        uuid.UUID  `json:"id"`
	Name      string     `json:"name"`
	ParentID  *uuid.UUID `json:"parent_id,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type updateUserHierarchyRequest struct {
	Role          *string `json:"role"`
	ManagerID     *string `json:"manager_id"`
	ManagerIDAlt  *string `json:"managerId"`
	DepartmentID  *string `json:"department_id"`
	DepartmentAlt *string `json:"departmentId"`
}

type createDepartmentRequest struct {
	Name        string  `json:"name"`
	ParentID    *string `json:"parent_id"`
	ParentIDAlt *string `json:"parentId"`
}

type updateProfileRequest struct {
	Email       *string `json:"email"`
	FullName    *string `json:"full_name"`
	FullNameAlt *string `json:"fullName"`
	AvatarURL   *string `json:"avatar_url"`
	AvatarAlt   *string `json:"avatarUrl"`
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	contentType := r.Header.Get("Content-Type")
	if !strings.HasPrefix(strings.ToLower(contentType), "application/json") {
		log.Printf("register: unexpected content-type: %s", contentType)
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read body"})
		return
	}
	log.Printf("register: raw body: %s", string(bodyBytes))

	var req authRequest
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}
	log.Printf("register: decoded payload: %+v", req)

	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email and password are required"})
		return
	}
	if _, err := mail.ParseAddress(req.Email); err != nil {
		log.Printf("register: email parse error: %v", err)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to hash password"})
		return
	}

	user, err := h.repo.CreateUser(r.Context(), req.Email, string(hash))
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "email already registered"})
			return
		}
		log.Printf("register: create user error: %v", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to create user"})
		return
	}

	writeJSON(w, http.StatusCreated, buildUserResponse(user))
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email and password are required"})
		return
	}
	if _, err := mail.ParseAddress(req.Email); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid email"})
		return
	}

	user, err := h.repo.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}

	accessToken, err := h.svc.CreateToken(user.ID.String(), 15*time.Minute)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create token"})
		return
	}
	refreshToken, err := h.svc.CreateToken(user.ID.String(), 7*24*time.Hour)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create token"})
		return
	}

	writeJSON(w, http.StatusOK, authResponse{AccessToken: accessToken, RefreshToken: refreshToken})
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}
	if strings.TrimSpace(req.RefreshToken) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "refresh token is required"})
		return
	}

	token, err := h.svc.ParseToken(req.RefreshToken)
	if err != nil || !token.Valid {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid token"})
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid token claims"})
		return
	}

	userID, ok := claims["sub"].(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid token subject"})
		return
	}

	accessToken, err := h.svc.CreateToken(userID, 15*time.Minute)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create token"})
		return
	}

	writeJSON(w, http.StatusOK, authResponse{AccessToken: accessToken, RefreshToken: req.RefreshToken})
}

func (h *Handler) GetUserProfile(w http.ResponseWriter, r *http.Request) {
	userIDStr, ok := UserIDFromContext(r.Context())
	if !ok || userIDStr == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	requesterID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid token subject"})
		return
	}

	paramID := chi.URLParam(r, "id")
	if strings.TrimSpace(paramID) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user id is required"})
		return
	}

	targetID, err := uuid.Parse(paramID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user id"})
		return
	}

	user, err := h.repo.GetUserByID(r.Context(), targetID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load user"})
		return
	}

	if requesterID != user.ID {
		if user.ManagerID == nil || *user.ManagerID != requesterID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
	}

	writeJSON(w, http.StatusOK, buildUserResponse(user))
}

func (h *Handler) GetUserManager(w http.ResponseWriter, r *http.Request) {
	paramID := chi.URLParam(r, "id")
	if strings.TrimSpace(paramID) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user id is required"})
		return
	}

	userID, err := uuid.Parse(paramID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user id"})
		return
	}

	user, err := h.repo.GetUserByID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load user"})
		return
	}

	if user.ManagerID == nil {
		writeJSON(w, http.StatusOK, nil)
		return
	}

	manager, err := h.repo.GetUserByID(r.Context(), *user.ManagerID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "manager not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load manager"})
		return
	}

	writeJSON(w, http.StatusOK, buildUserResponse(manager))
}

func (h *Handler) GetUserSubordinates(w http.ResponseWriter, r *http.Request) {
	paramID := chi.URLParam(r, "id")
	if strings.TrimSpace(paramID) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user id is required"})
		return
	}

	managerID, err := uuid.Parse(paramID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user id"})
		return
	}

	_, err = h.repo.GetUserByID(r.Context(), managerID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load user"})
		return
	}

	subordinates, err := h.repo.ListUsersByManagerID(r.Context(), managerID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load subordinates"})
		return
	}

	resp := make([]userResponse, 0, len(subordinates))
	for _, user := range subordinates {
		resp = append(resp, buildUserResponse(user))
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) GetHierarchy(w http.ResponseWriter, r *http.Request) {
	users, err := h.repo.ListUsers(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load hierarchy"})
		return
	}

	nodes := make(map[uuid.UUID]*hierarchyNode, len(users))
	for _, user := range users {
		nodes[user.ID] = &hierarchyNode{
			ID:             user.ID,
			FullName:       user.FullName,
			AvatarURL:      user.AvatarURL,
			Email:          user.Email,
			Role:           user.Role,
			ManagerID:      user.ManagerID,
			DepartmentID:   user.DepartmentID,
			DepartmentName: user.DepartmentName,
		}
	}

	var roots []*hierarchyNode
	for _, user := range users {
		node := nodes[user.ID]
		if user.ManagerID != nil {
			managerNode, ok := nodes[*user.ManagerID]
			if ok {
				managerNode.Subordinates = append(managerNode.Subordinates, node)
				continue
			}
		}
		roots = append(roots, node)
	}

	if len(roots) == 1 {
		writeJSON(w, http.StatusOK, roots[0])
		return
	}

	writeJSON(w, http.StatusOK, roots)
}

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.repo.ListUsers(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load users"})
		return
	}

	resp := make([]userResponse, 0, len(users))
	for _, user := range users {
		resp = append(resp, buildUserResponse(user))
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) CreateDepartment(w http.ResponseWriter, r *http.Request) {
	var req createDepartmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}
	if len(name) > 120 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is too long"})
		return
	}

	parentID, err := parseOptionalUUID(req.ParentID, req.ParentIDAlt)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid parent id"})
		return
	}
	if parentID != nil {
		if _, err := h.repo.GetDepartmentByID(r.Context(), *parentID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "parent department not found"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to validate parent department"})
			return
		}
	}

	department, err := h.repo.CreateDepartment(r.Context(), name, parentID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "department name already exists"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create department"})
		return
	}

	writeJSON(w, http.StatusCreated, departmentResponse{
		ID:        department.ID,
		Name:      department.Name,
		ParentID:  department.ParentID,
		CreatedAt: department.CreatedAt,
	})
}

func (h *Handler) ListDepartments(w http.ResponseWriter, r *http.Request) {
	departments, err := h.repo.ListDepartments(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load departments"})
		return
	}

	resp := make([]departmentResponse, 0, len(departments))
	for _, department := range departments {
		resp = append(resp, departmentResponse{
			ID:        department.ID,
			Name:      department.Name,
			ParentID:  department.ParentID,
			CreatedAt: department.CreatedAt,
		})
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) UpdateUserHierarchy(w http.ResponseWriter, r *http.Request) {
	userIDStr, ok := UserIDFromContext(r.Context())
	if !ok || userIDStr == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	requesterID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid token subject"})
		return
	}

	paramID := chi.URLParam(r, "id")
	if strings.TrimSpace(paramID) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user id is required"})
		return
	}

	targetID, err := uuid.Parse(paramID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user id"})
		return
	}

	targetUser, err := h.repo.GetUserByID(r.Context(), targetID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load user"})
		return
	}

	allowed, err := h.canEditHierarchy(r.Context(), requesterID, targetUser)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to validate permissions"})
		return
	}
	if !allowed {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read body"})
		return
	}

	var req updateUserHierarchyRequest
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	rawFields := make(map[string]json.RawMessage)
	if err := json.Unmarshal(bodyBytes, &rawFields); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	role := targetUser.Role
	if hasAnyField(rawFields, "role") {
		role = normalizeRole(req.Role)
		if role != nil && len(*role) > 120 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "role is too long"})
			return
		}
	}

	managerID := targetUser.ManagerID
	if hasAnyField(rawFields, "manager_id", "managerId") {
		managerID, err = parseOptionalUUID(req.ManagerID, req.ManagerIDAlt)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid manager id"})
			return
		}
		if managerID != nil {
			if *managerID == targetID {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user cannot manage self"})
				return
			}

			if _, err := h.repo.GetUserByID(r.Context(), *managerID); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusBadRequest, map[string]string{"error": "manager not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to validate manager"})
				return
			}

			createsCycle, err := h.wouldCreateManagerCycle(r.Context(), targetID, *managerID)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to validate hierarchy"})
				return
			}
			if createsCycle {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "manager hierarchy cycle detected"})
				return
			}
		}
	}

	departmentID := targetUser.DepartmentID
	if hasAnyField(rawFields, "department_id", "departmentId") {
		departmentID, err = parseOptionalUUID(req.DepartmentID, req.DepartmentAlt)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid department id"})
			return
		}
		if departmentID != nil {
			if _, err := h.repo.GetDepartmentByID(r.Context(), *departmentID); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusBadRequest, map[string]string{"error": "department not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to validate department"})
				return
			}
		}
	}

	user, err := h.repo.UpdateUserHierarchy(r.Context(), targetID, role, managerID, departmentID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update user hierarchy"})
		return
	}

	writeJSON(w, http.StatusOK, buildUserResponse(user))
}

func (h *Handler) UpdateUserProfile(w http.ResponseWriter, r *http.Request) {
	userIDStr, ok := UserIDFromContext(r.Context())
	if !ok || userIDStr == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	requesterID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid token subject"})
		return
	}

	paramID := chi.URLParam(r, "id")
	if strings.TrimSpace(paramID) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user id is required"})
		return
	}

	targetID, err := uuid.Parse(paramID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user id"})
		return
	}

	if requesterID != targetID {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}

	current, err := h.repo.GetUserByID(r.Context(), targetID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load user"})
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read body"})
		return
	}

	var req updateProfileRequest
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	rawFields := make(map[string]json.RawMessage)
	if err := json.Unmarshal(bodyBytes, &rawFields); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	email := current.Email
	if hasAnyField(rawFields, "email") {
		if req.Email == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email is required"})
			return
		}
		email = strings.TrimSpace(*req.Email)
		if email == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email is required"})
			return
		}
		if _, err := mail.ParseAddress(email); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid email"})
			return
		}
	}

	fullName := current.FullName
	if hasAnyField(rawFields, "full_name", "fullName") {
		value := req.FullName
		if value == nil {
			value = req.FullNameAlt
		}
		if value == nil {
			fullName = nil
		} else {
			trimmed := strings.TrimSpace(*value)
			if trimmed == "" {
				fullName = nil
			} else {
				if len(trimmed) > 120 {
					writeJSON(w, http.StatusBadRequest, map[string]string{"error": "full name is too long"})
					return
				}
				fullName = &trimmed
			}
		}
	}

	avatarURL := current.AvatarURL
	if hasAnyField(rawFields, "avatar_url", "avatarUrl") {
		value := req.AvatarURL
		if value == nil {
			value = req.AvatarAlt
		}

		normalizedAvatarURL, err := normalizeAvatarURL(value)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		avatarURL = normalizedAvatarURL
	}

	updated, err := h.repo.UpdateUserProfile(r.Context(), targetID, email, fullName, avatarURL)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "email already registered"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update profile"})
		return
	}

	writeJSON(w, http.StatusOK, buildUserResponse(updated))
}

func (h *Handler) wouldCreateManagerCycle(ctx context.Context, userID, managerID uuid.UUID) (bool, error) {
	currentID := managerID
	visited := make(map[uuid.UUID]struct{})

	for {
		if currentID == userID {
			return true, nil
		}

		if _, seen := visited[currentID]; seen {
			return true, nil
		}
		visited[currentID] = struct{}{}

		user, err := h.repo.GetUserByID(ctx, currentID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return false, nil
			}
			return false, err
		}

		if user.ManagerID == nil {
			return false, nil
		}

		currentID = *user.ManagerID
	}
}

func normalizeRole(raw *string) *string {
	if raw == nil {
		return nil
	}

	value := strings.TrimSpace(*raw)
	if value == "" {
		return nil
	}

	return &value
}

func normalizeAvatarURL(raw *string) (*string, error) {
	if raw == nil {
		return nil, nil
	}

	trimmed := strings.TrimSpace(*raw)
	if trimmed == "" {
		return nil, nil
	}

	if len(trimmed) > 1024 {
		return nil, errors.New("avatar url is too long")
	}

	if strings.HasPrefix(trimmed, "/uploads/") || strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
		return &trimmed, nil
	}

	return nil, errors.New("invalid avatar url")
}

func parseOptionalUUID(values ...*string) (*uuid.UUID, error) {
	for _, value := range values {
		if value == nil {
			continue
		}

		trimmed := strings.TrimSpace(*value)
		if trimmed == "" || strings.EqualFold(trimmed, "null") {
			return nil, nil
		}

		parsed, err := uuid.Parse(trimmed)
		if err != nil {
			return nil, err
		}
		return &parsed, nil
	}

	return nil, nil
}

func hasAnyField(fields map[string]json.RawMessage, keys ...string) bool {
	for _, key := range keys {
		if _, ok := fields[key]; ok {
			return true
		}
	}
	return false
}

func (h *Handler) canEditHierarchy(ctx context.Context, requesterID uuid.UUID, targetUser User) (bool, error) {
	if requesterID == targetUser.ID {
		return true, nil
	}

	requester, err := h.repo.GetUserByID(ctx, requesterID)
	if err != nil {
		return false, err
	}

	// Root node and HR/CEO roles can edit hierarchy globally.
	if requester.ManagerID == nil || hasHierarchyAdminRole(requester.Role) {
		return true, nil
	}

	// Direct manager can edit subordinate.
	if targetUser.ManagerID != nil && *targetUser.ManagerID == requesterID {
		return true, nil
	}

	return false, nil
}

func hasHierarchyAdminRole(role *string) bool {
	if role == nil {
		return false
	}

	normalized := strings.ToLower(strings.TrimSpace(*role))
	switch normalized {
	case "ceo", "hr", "hr manager", "hr_manager", "human resources":
		return true
	default:
		return false
	}
}

func buildUserResponse(user User) userResponse {
	return userResponse{
		ID:             user.ID,
		FullName:       user.FullName,
		AvatarURL:      user.AvatarURL,
		Email:          user.Email,
		Role:           user.Role,
		ManagerID:      user.ManagerID,
		DepartmentID:   user.DepartmentID,
		DepartmentName: user.DepartmentName,
		CreatedAt:      user.CreatedAt,
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
