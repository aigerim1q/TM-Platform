package chats

import (
	"time"

	"github.com/google/uuid"
)

type UserItem struct {
	ID                uuid.UUID  `json:"id"`
	Email             string     `json:"email"`
	FullName          *string    `json:"full_name,omitempty"`
	AvatarURL         *string    `json:"avatar_url,omitempty"`
	Role              *string    `json:"role,omitempty"`
	DepartmentName    *string    `json:"department_name,omitempty"`
	ThreadID          *uuid.UUID `json:"thread_id,omitempty"`
	Online            bool       `json:"online"`
	LastSeen          *time.Time `json:"last_seen,omitempty"`
	LastMessage       *string    `json:"last_message,omitempty"`
	LastMessageType   *string    `json:"last_message_type,omitempty"`
	LastMessageAt     *time.Time `json:"last_message_at,omitempty"`
	LastMessageSender *uuid.UUID `json:"last_message_sender,omitempty"`
}

type ThreadItem struct {
	ID                uuid.UUID  `json:"id"`
	Name              string     `json:"name"`
	AvatarURL         *string    `json:"avatar_url,omitempty"`
	IsGroup           bool       `json:"is_group"`
	PartnerID         *uuid.UUID `json:"partner_id,omitempty"`
	PartnerEmail      *string    `json:"partner_email,omitempty"`
	PartnerFullName   *string    `json:"partner_full_name,omitempty"`
	PartnerAvatarURL  *string    `json:"partner_avatar_url,omitempty"`
	PartnerRole       *string    `json:"partner_role,omitempty"`
	PartnerDepartment *string    `json:"partner_department,omitempty"`
	Online            bool       `json:"online"`
	LastMessage       *string    `json:"last_message,omitempty"`
	LastMessageType   *string    `json:"last_message_type,omitempty"`
	LastMessageAt     *time.Time `json:"last_message_at,omitempty"`
	LastMessageSender *uuid.UUID `json:"last_message_sender,omitempty"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type Message struct {
	ID             uuid.UUID `json:"id"`
	ThreadID       uuid.UUID `json:"thread_id"`
	SenderID       uuid.UUID `json:"sender_id"`
	Text           *string   `json:"text,omitempty"`
	AttachmentURL  *string   `json:"attachment_url,omitempty"`
	AttachmentType *string   `json:"attachment_type,omitempty"`
	AttachmentName *string   `json:"attachment_name,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}
