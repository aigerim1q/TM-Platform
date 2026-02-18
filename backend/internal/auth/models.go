package auth

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	FullName       *string    `json:"full_name,omitempty" db:"full_name"`
	AvatarURL      *string    `json:"avatar_url,omitempty" db:"avatar_url"`
	Email          string     `json:"email" db:"email"`
	PasswordHash   string     `json:"password_hash" db:"password_hash"`
	Role           *string    `json:"role" db:"role"`
	ManagerID      *uuid.UUID `json:"manager_id,omitempty" db:"manager_id"`
	DepartmentID   *uuid.UUID `json:"department_id,omitempty" db:"department_id"`
	DepartmentName *string    `json:"department_name,omitempty" db:"department_name"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
}

type Department struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	Name      string     `json:"name" db:"name"`
	ParentID  *uuid.UUID `json:"parent_id,omitempty" db:"parent_id"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
}
