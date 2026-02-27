package aichat

import (
	"encoding/json"
	"net/http"
	"strings"

	"tm-platform-backend/internal/auth"

	"github.com/google/uuid"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

type createMessageRequest struct {
	Mode        string          `json:"mode"`
	Sender      string          `json:"sender"`
	Text        string          `json:"text"`
	ProjectInfo json.RawMessage `json:"projectInfo"`
}

func (h *Handler) ListMessages(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromRequest(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	mode := r.URL.Query().Get("mode")
	messages, err := h.repo.ListMessages(r.Context(), userID, mode)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch messages"})
		return
	}

	writeJSON(w, http.StatusOK, messages)
}

func (h *Handler) AppendMessage(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromRequest(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var req createMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	message, err := h.repo.AppendMessage(r.Context(), userID, req.Mode, req.Sender, req.Text, req.ProjectInfo)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save message"})
		return
	}

	writeJSON(w, http.StatusCreated, message)
}

func (h *Handler) ResetMessages(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromRequest(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	mode := r.URL.Query().Get("mode")
	if err := h.repo.ResetMessages(r.Context(), userID, mode); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to reset messages"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func userIDFromRequest(r *http.Request) (uuid.UUID, bool) {
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

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
