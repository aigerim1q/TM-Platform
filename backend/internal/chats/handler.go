package chats

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"tm-platform-backend/internal/auth"
	"tm-platform-backend/internal/notifications"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type Handler struct {
	repo              *Repository
	notificationsRepo *notifications.Repository
}

func NewHandler(repo *Repository, notificationsRepo *notifications.Repository) *Handler {
	return &Handler{repo: repo, notificationsRepo: notificationsRepo}
}

type ensureDirectThreadRequest struct {
	UserID    *string `json:"user_id"`
	UserIDAlt *string `json:"userId"`
}

type createGroupThreadRequest struct {
	Name         *string  `json:"name"`
	MemberIDs    []string `json:"member_ids"`
	MemberIDsAlt []string `json:"memberIds"`
}

type renameThreadRequest struct {
	Name *string `json:"name"`
}

type callInviteRequest struct {
	RoomID *string `json:"roomId"`
}

type appendMessageRequest struct {
	Text            *string `json:"text"`
	AttachmentURL   *string `json:"attachment_url"`
	AttachmentURL2  *string `json:"attachmentUrl"`
	AttachmentType  *string `json:"attachment_type"`
	AttachmentType2 *string `json:"attachmentType"`
	AttachmentName  *string `json:"attachment_name"`
	AttachmentName2 *string `json:"attachmentName"`
}

func (h *Handler) TouchPresence(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	if err := h.repo.UpsertPresence(r.Context(), userID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update presence"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	limit := parseLimit(r.URL.Query().Get("limit"), 40)
	items, err := h.repo.ListUsers(r.Context(), userID, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load users"})
		return
	}

	writeJSON(w, http.StatusOK, items)
}

func (h *Handler) ListThreads(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	limit := parseLimit(r.URL.Query().Get("limit"), 60)
	items, err := h.repo.ListThreads(r.Context(), userID, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load chats"})
		return
	}

	writeJSON(w, http.StatusOK, items)
}

func (h *Handler) UnreadCount(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	count, err := h.repo.UnreadCount(r.Context(), userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to count unread chats"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]int{"count": count})
}

func (h *Handler) EnsureDirectThread(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var req ensureDirectThreadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	targetRaw := firstNonNilString(req.UserID, req.UserIDAlt)
	if targetRaw == nil || strings.TrimSpace(*targetRaw) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "userId is required"})
		return
	}

	targetUserID, err := uuid.Parse(strings.TrimSpace(*targetRaw))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user id"})
		return
	}

	thread, err := h.repo.EnsureDirectThread(r.Context(), userID, targetUserID)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot create chat with self"})
		case errors.Is(err, sql.ErrNoRows):
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create chat"})
		}
		return
	}

	writeJSON(w, http.StatusCreated, thread)
}

func (h *Handler) CreateGroupThread(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var req createGroupThreadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	name := strings.TrimSpace(stringValue(req.Name))
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}

	memberIDsRaw := req.MemberIDs
	if len(memberIDsRaw) == 0 {
		memberIDsRaw = req.MemberIDsAlt
	}

	unique := make(map[uuid.UUID]struct{})
	memberIDs := make([]uuid.UUID, 0, len(memberIDsRaw))
	for _, raw := range memberIDsRaw {
		parsed, err := uuid.Parse(strings.TrimSpace(raw))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid member id"})
			return
		}
		if parsed == userID {
			continue
		}
		if _, exists := unique[parsed]; exists {
			continue
		}
		unique[parsed] = struct{}{}
		memberIDs = append(memberIDs, parsed)
	}

	thread, err := h.repo.CreateGroupThread(r.Context(), userID, name, memberIDs)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "group requires at least 2 members"})
		case errors.Is(err, sql.ErrNoRows):
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "member not found"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create group"})
		}
		return
	}

	if h.notificationsRepo != nil {
		for _, memberID := range memberIDs {
			if memberID == userID {
				continue
			}
			actor := userID
			_ = h.notificationsRepo.Create(
				r.Context(),
				memberID,
				&actor,
				notifications.KindProjectMember,
				"Вас добавили в чат",
				"Вы добавлены в групповой чат: "+thread.Name,
				"/chats?id="+thread.ID.String(),
				"chat_thread",
				&thread.ID,
			)
		}
	}

	writeJSON(w, http.StatusCreated, thread)
}

func (h *Handler) RenameThread(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	threadID, err := parseThreadID(chi.URLParam(r, "threadId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid thread id"})
		return
	}

	var req renameThreadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	thread, err := h.repo.RenameThread(r.Context(), userID, threadID, stringValue(req.Name))
	if err != nil {
		switch {
		case errors.Is(err, ErrForbidden):
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		case errors.Is(err, ErrInvalidInput):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "chat rename is available only for group chats with non-empty name"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to rename chat"})
		}
		return
	}

	writeJSON(w, http.StatusOK, thread)
}

func (h *Handler) InviteToCall(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	threadID, err := parseThreadID(chi.URLParam(r, "threadId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid thread id"})
		return
	}

	var req callInviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	roomID := strings.TrimSpace(stringValue(req.RoomID))
	if roomID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "roomId is required"})
		return
	}

	thread, err := h.repo.GetThread(r.Context(), userID, threadID)
	if err != nil {
		switch {
		case errors.Is(err, ErrForbidden):
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load chat"})
		}
		return
	}

	members, err := h.repo.ListThreadMemberIDs(r.Context(), userID, threadID)
	if err != nil {
		switch {
		case errors.Is(err, ErrForbidden):
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load chat members"})
		}
		return
	}

	if h.notificationsRepo != nil {
		chatName := strings.TrimSpace(thread.Name)
		if chatName == "" {
			chatName = "Чат"
		}

		callLink := "/chats?id=" + threadID.String() + "&callRoom=" + url.QueryEscape(roomID)
		for _, memberID := range members {
			if memberID == userID {
				continue
			}

			actor := userID
			_ = h.notificationsRepo.Create(
				r.Context(),
				memberID,
				&actor,
				notifications.KindCallInvite,
				"Вас зовут на видеозвонок",
				"Подключиться к звонку в чате: "+chatName,
				callLink,
				"chat_call",
				&threadID,
			)
		}
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handler) ListMessages(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	threadID, err := parseThreadID(chi.URLParam(r, "threadId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid thread id"})
		return
	}

	limit := parseLimit(r.URL.Query().Get("limit"), 80)
	before, err := parseOptionalTime(r.URL.Query().Get("before"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid before"})
		return
	}

	items, err := h.repo.ListMessages(r.Context(), userID, threadID, limit, before)
	if err != nil {
		switch {
		case errors.Is(err, ErrForbidden):
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load messages"})
		}
		return
	}

	writeJSON(w, http.StatusOK, items)
}

func (h *Handler) AppendMessage(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	threadID, err := parseThreadID(chi.URLParam(r, "threadId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid thread id"})
		return
	}

	var req appendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	message, err := h.repo.AppendMessage(
		r.Context(),
		userID,
		threadID,
		req.Text,
		firstNonNilString(req.AttachmentURL, req.AttachmentURL2),
		firstNonNilString(req.AttachmentType, req.AttachmentType2),
		firstNonNilString(req.AttachmentName, req.AttachmentName2),
	)
	if err != nil {
		switch {
		case errors.Is(err, ErrForbidden):
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		case errors.Is(err, ErrInvalidInput):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message is empty"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to send message"})
		}
		return
	}

	if h.notificationsRepo != nil {
		memberIDs, membersErr := h.repo.ListThreadMemberIDs(r.Context(), userID, threadID)
		if membersErr == nil {
			for _, memberID := range memberIDs {
				if memberID == userID {
					continue
				}

				body := "Вам отправили сообщение"
				if message.Text != nil && strings.TrimSpace(*message.Text) != "" {
					text := strings.TrimSpace(*message.Text)
					if len(text) > 120 {
						text = text[:120] + "..."
					}
					body = text
				}

				actor := userID
				_ = h.notificationsRepo.Create(
					r.Context(),
					memberID,
					&actor,
					notifications.KindTaskComment,
					"Новое сообщение в чате",
					body,
					"/chats?id="+threadID.String(),
					"chat_message",
					&message.ID,
				)
			}
		}
	}

	writeJSON(w, http.StatusCreated, message)
}

func parseThreadID(raw string) (uuid.UUID, error) {
	return uuid.Parse(strings.TrimSpace(raw))
}

func parseLimit(raw string, fallback int) int {
	value := strings.TrimSpace(raw)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	if parsed < 1 {
		return fallback
	}
	if parsed > 200 {
		return 200
	}
	return parsed
}

func parseOptionalTime(raw string) (*time.Time, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil, nil
	}

	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func firstNonNilString(values ...*string) *string {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func userIDFromContext(r *http.Request) (uuid.UUID, bool) {
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
