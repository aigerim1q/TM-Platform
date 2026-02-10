package auth

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID  `json:"id" db:"id"`
	Email        string     `json:"email" db:"email"`
	PasswordHash string     `json:"password_hash" db:"password_hash"`
	Role         *string    `json:"role" db:"role"`
	ManagerID    *uuid.UUID `json:"manager_id,omitempty" db:"manager_id"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
}
