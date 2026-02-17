package aichat

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type Repository struct {
	db         *sql.DB
	schemaOnce sync.Once
	schemaErr  error
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ensureSchema(ctx context.Context) error {
	r.schemaOnce.Do(func() {
		_, r.schemaErr = r.db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS ai_chat_threads (
	id UUID PRIMARY KEY,
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	mode TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (user_id, mode)
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
	id UUID PRIMARY KEY,
	thread_id UUID NOT NULL REFERENCES ai_chat_threads(id) ON DELETE CASCADE,
	sender TEXT NOT NULL,
	text TEXT NOT NULL,
	project_info JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_thread_created
	ON ai_chat_messages(thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_ai_chat_threads_user_updated
	ON ai_chat_threads(user_id, updated_at DESC);
`)
	})

	return r.schemaErr
}

type Message struct {
	ID          uuid.UUID       `json:"id"`
	ThreadID    uuid.UUID       `json:"threadId"`
	Sender      string          `json:"sender"`
	Text        string          `json:"text"`
	ProjectInfo json.RawMessage `json:"projectInfo,omitempty"`
	CreatedAt   time.Time       `json:"createdAt"`
}

func normalizeMode(mode string) string {
	value := strings.ToLower(strings.TrimSpace(mode))
	switch value {
	case "ordinary", "template":
		return value
	default:
		return "template"
	}
}

func normalizeSender(sender string) string {
	value := strings.ToLower(strings.TrimSpace(sender))
	switch value {
	case "user", "other":
		return value
	default:
		return "other"
	}
}

func (r *Repository) ensureThread(ctx context.Context, userID uuid.UUID, mode string) (uuid.UUID, error) {
	if err := r.ensureSchema(ctx); err != nil {
		return uuid.Nil, err
	}

	mode = normalizeMode(mode)

	var id uuid.UUID
	newID := uuid.New()
	err := r.db.QueryRowContext(
		ctx,
		`INSERT INTO ai_chat_threads (id, user_id, mode)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, mode)
		 DO UPDATE SET updated_at = now()
		 RETURNING id`,
		newID,
		userID,
		mode,
	).Scan(&id)
	if err != nil {
		return uuid.Nil, err
	}

	return id, nil
}

func (r *Repository) ListMessages(ctx context.Context, userID uuid.UUID, mode string) ([]Message, error) {
	if err := r.ensureSchema(ctx); err != nil {
		return nil, err
	}

	threadID, err := r.ensureThread(ctx, userID, mode)
	if err != nil {
		return nil, err
	}

	rows, err := r.db.QueryContext(
		ctx,
		`SELECT id, thread_id, sender, text, project_info, created_at
		 FROM ai_chat_messages
		 WHERE thread_id = $1
		 ORDER BY created_at ASC`,
		threadID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := make([]Message, 0)
	for rows.Next() {
		var m Message
		var projectInfo []byte

		if err := rows.Scan(&m.ID, &m.ThreadID, &m.Sender, &m.Text, &projectInfo, &m.CreatedAt); err != nil {
			return nil, err
		}

		if len(projectInfo) > 0 && string(projectInfo) != "null" {
			m.ProjectInfo = projectInfo
		}

		messages = append(messages, m)
	}

	return messages, rows.Err()
}

func (r *Repository) AppendMessage(ctx context.Context, userID uuid.UUID, mode, sender, text string, projectInfo json.RawMessage) (Message, error) {
	if err := r.ensureSchema(ctx); err != nil {
		return Message{}, err
	}

	threadID, err := r.ensureThread(ctx, userID, mode)
	if err != nil {
		return Message{}, err
	}

	sender = normalizeSender(sender)
	text = strings.TrimSpace(text)
	if text == "" {
		text = "..."
	}

	if len(projectInfo) == 0 {
		projectInfo = json.RawMessage("null")
	}

	var m Message
	var storedProjectInfo []byte

	err = r.db.QueryRowContext(
		ctx,
		`INSERT INTO ai_chat_messages (id, thread_id, sender, text, project_info)
		 VALUES ($1, $2, $3, $4, $5::jsonb)
		 RETURNING id, thread_id, sender, text, project_info, created_at`,
		uuid.New(),
		threadID,
		sender,
		text,
		projectInfo,
	).Scan(&m.ID, &m.ThreadID, &m.Sender, &m.Text, &storedProjectInfo, &m.CreatedAt)
	if err != nil {
		return Message{}, err
	}

	if len(storedProjectInfo) > 0 && string(storedProjectInfo) != "null" {
		m.ProjectInfo = storedProjectInfo
	}

	_, _ = r.db.ExecContext(ctx, `UPDATE ai_chat_threads SET updated_at = now() WHERE id = $1`, threadID)

	return m, nil
}
