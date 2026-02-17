package hierarchy

import "github.com/google/uuid"

type NodeType string

const (
	NodeTypeCompany    NodeType = "company"
	NodeTypeDepartment NodeType = "department"
	NodeTypeUser       NodeType = "user"
)

type TreeUser struct {
	ID        uuid.UUID  `json:"id"`
	Email     string     `json:"email"`
	FullName  *string    `json:"full_name,omitempty"`
	AvatarURL *string    `json:"avatar_url,omitempty"`
	Role      *string    `json:"role,omitempty"`
	ManagerID *uuid.UUID `json:"manager_id,omitempty"`
}

type TreeNode struct {
	ID        uuid.UUID   `json:"id"`
	Title     string      `json:"title"`
	Type      NodeType    `json:"type"`
	ParentID  *uuid.UUID  `json:"parent_id,omitempty"`
	UserID    *uuid.UUID  `json:"user_id,omitempty"`
	Position  int         `json:"position"`
	Level     int         `json:"level"`
	Path      string      `json:"path"`
	Status    string      `json:"status"`
	RoleTitle *string     `json:"role_title,omitempty"`
	User      *TreeUser   `json:"user,omitempty"`
	Children  []*TreeNode `json:"children"`
}

type CatalogItem struct {
	ID       uuid.UUID `json:"id"`
	Name     string    `json:"name"`
	IsSystem bool      `json:"is_system"`
}

type createNodeInput struct {
	Title    string
	Type     NodeType
	ParentID *uuid.UUID
	Position *int
}

type updateNodeInput struct {
	Title     *string
	ParentSet bool
	ParentID  *uuid.UUID
	Position  *int
	RoleTitle *string
	RoleSet   bool
}
