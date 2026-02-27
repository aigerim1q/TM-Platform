package hierarchy

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"tm-platform-backend/internal/auth"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type Handler struct {
	repo     *Repository
	authRepo *auth.Repository
}

func NewHandler(repo *Repository, authRepo *auth.Repository) *Handler {
	return &Handler{repo: repo, authRepo: authRepo}
}

type createNodeRequest struct {
	Title    string  `json:"title"`
	Type     string  `json:"type"`
	ParentID *string `json:"parent_id"`
	Position *int    `json:"position"`
}

type updateNodeRequest struct {
	Title     *string `json:"title"`
	ParentID  *string `json:"parent_id"`
	Position  *int    `json:"position"`
	RoleTitle *string `json:"role_title"`
}

type assignUserRequest struct {
	NodeID *string `json:"node_id"`
	UserID *string `json:"user_id"`
}

type permissionsResponse struct {
	CanEdit       bool `json:"can_edit"`
	CanAddRole    bool `json:"can_add_role"`
	CanAddDept    bool `json:"can_add_department"`
	CanAssignUser bool `json:"can_assign_user"`
}

type treeResponse struct {
	Permissions   permissionsResponse `json:"permissions"`
	CurrentUserID string              `json:"current_user_id"`
	Catalogs      catalogsResponse    `json:"catalogs"`
	Tree          []*TreeNode         `json:"tree"`
}

type catalogsResponse struct {
	Departments []CatalogItem `json:"departments"`
	Roles       []CatalogItem `json:"roles"`
}

func (h *Handler) GetTree(w http.ResponseWriter, r *http.Request) {
	user, canManage, err := h.resolveCurrentUserAndPermission(r.Context())
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "user not found"})
			return
		}
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	nodes, err := h.repo.ListNodes(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load hierarchy tree"})
		return
	}

	departments, err := h.repo.ListDepartmentCatalog(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load hierarchy departments"})
		return
	}

	roles, err := h.repo.ListRoleCatalog(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load hierarchy roles"})
		return
	}

	tree := buildTree(nodes)
	writeJSON(w, http.StatusOK, treeResponse{
		Permissions: permissionsResponse{
			CanEdit:       canManage,
			CanAddRole:    canManage,
			CanAddDept:    canManage,
			CanAssignUser: canManage,
		},
		CurrentUserID: user.ID.String(),
		Catalogs: catalogsResponse{
			Departments: departments,
			Roles:       roles,
		},
		Tree: tree,
	})
}

func (h *Handler) AssignUser(w http.ResponseWriter, r *http.Request) {
	_, canManage, err := h.resolveCurrentUserAndPermission(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if !canManage {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}

	var req assignUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	if req.NodeID == nil || strings.TrimSpace(*req.NodeID) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "node_id is required"})
		return
	}
	if req.UserID == nil || strings.TrimSpace(*req.UserID) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id is required"})
		return
	}

	nodeID, err := uuid.Parse(strings.TrimSpace(*req.NodeID))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid node_id"})
		return
	}
	userID, err := uuid.Parse(strings.TrimSpace(*req.UserID))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user_id"})
		return
	}

	node, err := h.repo.AssignUserToNode(r.Context(), nodeID, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "node or user not found"})
			return
		}
		if strings.Contains(strings.ToLower(err.Error()), "cannot") {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to assign user"})
		return
	}

	writeJSON(w, http.StatusOK, mapDBNode(node))
}

func (h *Handler) CreateNode(w http.ResponseWriter, r *http.Request) {
	_, canManage, err := h.resolveCurrentUserAndPermission(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if !canManage {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}

	var req createNodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required"})
		return
	}
	if len(title) > 180 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is too long"})
		return
	}

	typeValue := NodeType(strings.ToLower(strings.TrimSpace(req.Type)))
	if typeValue != NodeTypeDepartment {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "type must be department"})
		return
	}

	parentID, err := parseOptionalUUID(req.ParentID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid parent_id"})
		return
	}

	node, err := h.repo.CreateNode(r.Context(), createNodeInput{
		Title:    title,
		Type:     typeValue,
		ParentID: parentID,
		Position: req.Position,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "parent node not found"})
			return
		}
		if strings.Contains(strings.ToLower(err.Error()), "cannot") {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create hierarchy node"})
		return
	}

	writeJSON(w, http.StatusCreated, mapDBNode(node))
}

func (h *Handler) UpdateNode(w http.ResponseWriter, r *http.Request) {
	_, canManage, err := h.resolveCurrentUserAndPermission(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if !canManage {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}

	nodeID, err := uuid.Parse(strings.TrimSpace(chi.URLParam(r, "id")))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid node id"})
		return
	}

	bodyBytes, err := ioReadAll(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	var req updateNodeRequest
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	var rawFields map[string]json.RawMessage
	if err := json.Unmarshal(bodyBytes, &rawFields); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	var title *string
	if _, ok := rawFields["title"]; ok {
		if req.Title == nil {
			empty := ""
			title = &empty
		} else {
			trimmed := strings.TrimSpace(*req.Title)
			title = &trimmed
		}
	}

	parentSet := false
	var parentID *uuid.UUID
	if _, ok := rawFields["parent_id"]; ok {
		parentSet = true
		parentID, err = parseOptionalUUID(req.ParentID)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid parent_id"})
			return
		}
	}

	if title != nil {
		if strings.TrimSpace(*title) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required"})
			return
		}
		if len(*title) > 180 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is too long"})
			return
		}
	}

	roleSet := false
	var roleTitle *string
	if _, ok := rawFields["role_title"]; ok {
		roleSet = true
		roleTitle = req.RoleTitle
	}

	node, err := h.repo.UpdateNode(r.Context(), nodeID, updateNodeInput{
		Title:     title,
		ParentSet: parentSet,
		ParentID:  parentID,
		Position:  req.Position,
		RoleTitle: roleTitle,
		RoleSet:   roleSet,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "node not found"})
			return
		}
		if strings.Contains(strings.ToLower(err.Error()), "subtree") {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update node"})
		return
	}

	writeJSON(w, http.StatusOK, mapDBNode(node))
}

func (h *Handler) DeleteNode(w http.ResponseWriter, r *http.Request) {
	_, canManage, err := h.resolveCurrentUserAndPermission(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if !canManage {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}

	nodeID, err := uuid.Parse(strings.TrimSpace(chi.URLParam(r, "id")))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid node id"})
		return
	}

	if err := h.repo.DeleteNode(r.Context(), nodeID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "node not found"})
			return
		}
		if strings.Contains(strings.ToLower(err.Error()), "cannot") {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete node"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

type updateStatusRequest struct {
	Status string `json:"status"`
}

func (h *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	_, canManage, err := h.resolveCurrentUserAndPermission(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if !canManage {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}

	nodeID, err := uuid.Parse(strings.TrimSpace(chi.URLParam(r, "id")))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid node id"})
		return
	}

	var req updateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	status := strings.ToLower(strings.TrimSpace(req.Status))
	if status != "free" && status != "busy" && status != "sick" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "status must be free, busy, or sick"})
		return
	}

	if err := h.repo.UpdateStatus(r.Context(), nodeID, status); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update status"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": status})
}

func buildTree(nodes []dbNode) []*TreeNode {
	mapped := make(map[uuid.UUID]*TreeNode, len(nodes))
	for _, item := range nodes {
		mapped[item.ID] = mapDBNode(item)
	}

	roots := make([]*TreeNode, 0)
	for _, item := range nodes {
		node := mapped[item.ID]
		if item.ParentID == nil {
			roots = append(roots, node)
			continue
		}
		parent, ok := mapped[*item.ParentID]
		if !ok {
			roots = append(roots, node)
			continue
		}
		parent.Children = append(parent.Children, node)
	}

	return roots
}

func mapDBNode(item dbNode) *TreeNode {
	node := &TreeNode{
		ID:       item.ID,
		Title:    item.Title,
		Type:     item.Type,
		ParentID: item.ParentID,
		UserID:   item.UserID,
		Position: item.Position,
		Level:    item.Level,
		Path:     item.Path,
		Status:   item.Status,
		Children: []*TreeNode{},
	}

	if item.RoleTitle.Valid {
		rt := strings.TrimSpace(item.RoleTitle.String)
		if rt != "" {
			node.RoleTitle = &rt
		}
	}

	if item.UserID != nil && item.UserEmail.Valid {
		node.User = &TreeUser{
			ID:        *item.UserID,
			Email:     item.UserEmail.String,
			ManagerID: item.UserManagerID,
		}
		if item.UserFullName.Valid {
			name := strings.TrimSpace(item.UserFullName.String)
			if name != "" {
				node.User.FullName = &name
			}
		}
		if item.UserAvatarURL.Valid {
			avatar := strings.TrimSpace(item.UserAvatarURL.String)
			if avatar != "" {
				node.User.AvatarURL = &avatar
			}
		}
		if item.UserRole.Valid {
			role := strings.TrimSpace(item.UserRole.String)
			if role != "" {
				node.User.Role = &role
			}
		}
	}

	return node
}

func (h *Handler) resolveCurrentUserAndPermission(ctx context.Context) (auth.User, bool, error) {
	userIDStr, ok := auth.UserIDFromContext(ctx)
	if !ok || strings.TrimSpace(userIDStr) == "" {
		return auth.User{}, false, errors.New("missing user in context")
	}

	userID, err := uuid.Parse(strings.TrimSpace(userIDStr))
	if err != nil {
		return auth.User{}, false, err
	}

	user, err := h.authRepo.GetUserByID(ctx, userID)
	if err != nil {
		return auth.User{}, false, err
	}

	if hasManageAccess(user) {
		return user, true, nil
	}

	hasAssignedHierarchyUser, err := h.repo.HasAssignedHierarchyUser(ctx)
	if err != nil {
		return auth.User{}, false, err
	}

	// Bootstrap mode: allow first logged-in user to configure hierarchy
	// (assign first CEO) when hierarchy has no assigned users yet.
	if !hasAssignedHierarchyUser {
		return user, true, nil
	}

	hasCompanyAssignedUser, err := h.repo.HasCompanyAssignedUser(ctx)
	if err != nil {
		return auth.User{}, false, err
	}

	// Recovery mode: if company root has no CEO user assigned,
	// allow a logged-in user to restore hierarchy ownership.
	if !hasCompanyAssignedUser {
		return user, true, nil
	}

	return user, false, nil
}

func hasManageAccess(user auth.User) bool {
	if user.Role != nil {
		normalizedRole := strings.ToLower(strings.TrimSpace(*user.Role))
		switch normalizedRole {
		case "owner", "ceo", "hr", "hr manager", "hr_manager", "human resources", "hr specialist", "hr_specialist":
			return true
		}
	}

	if user.DepartmentName != nil {
		normalizedDepartment := strings.ToLower(strings.TrimSpace(*user.DepartmentName))
		if strings.Contains(normalizedDepartment, "hr") || strings.Contains(normalizedDepartment, "human resources") || strings.Contains(normalizedDepartment, "кадр") {
			return true
		}
	}

	return false
}

func parseOptionalUUID(value *string) (*uuid.UUID, error) {
	if value == nil {
		return nil, nil
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

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func ioReadAll(r *http.Request) ([]byte, error) {
	defer r.Body.Close()
	return io.ReadAll(r.Body)
}
