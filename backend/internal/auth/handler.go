package auth

import (
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
	ID        uuid.UUID  `json:"id"`
	Email     string     `json:"email"`
	Role      *string    `json:"role"`
	ManagerID *uuid.UUID `json:"manager_id,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type hierarchyNode struct {
	ID           uuid.UUID        `json:"id"`
	Email        string           `json:"email"`
	Role         *string          `json:"role"`
	ManagerID    *uuid.UUID       `json:"manager_id,omitempty"`
	Subordinates []*hierarchyNode `json:"subordinates,omitempty"`
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

	writeJSON(w, http.StatusCreated, userResponse{
		ID:        user.ID,
		Email:     user.Email,
		Role:      user.Role,
		ManagerID: user.ManagerID,
		CreatedAt: user.CreatedAt,
	})
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

	writeJSON(w, http.StatusOK, userResponse{
		ID:        user.ID,
		Email:     user.Email,
		Role:      user.Role,
		ManagerID: user.ManagerID,
		CreatedAt: user.CreatedAt,
	})
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

	writeJSON(w, http.StatusOK, userResponse{
		ID:        manager.ID,
		Email:     manager.Email,
		Role:      manager.Role,
		ManagerID: manager.ManagerID,
		CreatedAt: manager.CreatedAt,
	})
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
		resp = append(resp, userResponse{
			ID:        user.ID,
			Email:     user.Email,
			Role:      user.Role,
			ManagerID: user.ManagerID,
			CreatedAt: user.CreatedAt,
		})
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
			ID:        user.ID,
			Email:     user.Email,
			Role:      user.Role,
			ManagerID: user.ManagerID,
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
		resp = append(resp, userResponse{
			ID:        user.ID,
			Email:     user.Email,
			Role:      user.Role,
			ManagerID: user.ManagerID,
			CreatedAt: user.CreatedAt,
		})
	}

	writeJSON(w, http.StatusOK, resp)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
