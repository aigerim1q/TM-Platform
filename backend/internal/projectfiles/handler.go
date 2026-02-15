package projectfiles

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"tm-platform-backend/internal/auth"

	"github.com/google/uuid"
)

var allowedFileTypes = map[string]struct{}{
	"image": {},
	"video": {},
	"file":  {},
}

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

type createProjectFileRequest struct {
	ProjectID string `json:"project_id"`
	URL       string `json:"url"`
	Type      string `json:"type"`
	Name      string `json:"name"`
	Size      int64  `json:"size"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	ownerID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	var req createProjectFileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	projectID, err := uuid.Parse(strings.TrimSpace(req.ProjectID))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid project_id"})
		return
	}

	url := strings.TrimSpace(req.URL)
	if url == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "url is required"})
		return
	}

	fileType := strings.ToLower(strings.TrimSpace(req.Type))
	if _, ok := allowedFileTypes[fileType]; !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid type"})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}

	if req.Size <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "size must be > 0"})
		return
	}

	file, err := h.repo.Create(r.Context(), ownerID, CreateProjectFileInput{
		ProjectID: projectID,
		URL:       url,
		Type:      fileType,
		Name:      name,
		Size:      req.Size,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "project not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save project file"})
		return
	}

	writeJSON(w, http.StatusCreated, file)
}

func (h *Handler) ListDocuments(w http.ResponseWriter, r *http.Request) {
	ownerID, err := userIDFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	documents, err := h.repo.ListDocumentsByOwner(r.Context(), ownerID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch documents"})
		return
	}

	writeJSON(w, http.StatusOK, documents)
}

func userIDFromRequest(r *http.Request) (uuid.UUID, error) {
	userIDStr, ok := auth.UserIDFromContext(r.Context())
	if !ok || strings.TrimSpace(userIDStr) == "" {
		return uuid.Nil, errors.New("unauthorized")
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, errors.New("invalid token subject")
	}

	return userID, nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
