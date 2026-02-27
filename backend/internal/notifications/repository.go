package notifications

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type Kind string

const (
	KindProjectCreated Kind = "project_created"
	KindTaskDelegated  Kind = "task_delegated"
	KindTaskAssigned   Kind = "task_assigned"
	KindProjectMember  Kind = "project_member"
	KindTaskComment    Kind = "task_comment"
	KindCallInvite     Kind = "call_invite"
)

type Notification struct {
	ID         uuid.UUID  `json:"id"`
	UserID     uuid.UUID  `json:"userId"`
	ActorID    *uuid.UUID `json:"actorId,omitempty"`
	ActorEmail string     `json:"actorEmail,omitempty"`
	Kind       Kind       `json:"kind"`
	Title      string     `json:"title"`
	Body       string     `json:"body"`
	Link       string     `json:"link"`
	EntityType string     `json:"entityType"`
	EntityID   *uuid.UUID `json:"entityId,omitempty"`
	ReadAt     *time.Time `json:"readAt,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
}

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, userID uuid.UUID, actorID *uuid.UUID, kind Kind, title, body, link, entityType string, entityID *uuid.UUID) error {
	_, err := r.db.ExecContext(
		ctx,
		`INSERT INTO notifications (user_id, actor_id, kind, title, body, link, entity_type, entity_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		userID,
		actorID,
		string(kind),
		title,
		body,
		link,
		entityType,
		entityID,
	)
	return err
}

func (r *Repository) ListByUser(ctx context.Context, userID uuid.UUID, unreadOnly bool, limit int) ([]Notification, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	query := `SELECT n.id, n.user_id, n.actor_id, COALESCE(u.email, ''), n.kind, n.title, n.body, n.link, n.entity_type, n.entity_id, n.read_at, n.created_at
		FROM notifications n
		LEFT JOIN users u ON u.id = n.actor_id
		WHERE n.user_id = $1`
	if unreadOnly {
		query += ` AND n.read_at IS NULL`
	}
	query += ` ORDER BY n.created_at DESC LIMIT $2`

	rows, err := r.db.QueryContext(ctx, query, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Notification, 0)
	for rows.Next() {
		var n Notification
		var actorID sql.NullString
		var actorEmail sql.NullString
		var entityID sql.NullString
		var readAt sql.NullTime
		if err := rows.Scan(
			&n.ID,
			&n.UserID,
			&actorID,
			&actorEmail,
			&n.Kind,
			&n.Title,
			&n.Body,
			&n.Link,
			&n.EntityType,
			&entityID,
			&readAt,
			&n.CreatedAt,
		); err != nil {
			return nil, err
		}

		if actorID.Valid {
			if parsed, parseErr := uuid.Parse(actorID.String); parseErr == nil {
				n.ActorID = &parsed
			}
		}
		if actorEmail.Valid {
			n.ActorEmail = actorEmail.String
		}
		if entityID.Valid {
			if parsed, parseErr := uuid.Parse(entityID.String); parseErr == nil {
				n.EntityID = &parsed
			}
		}
		if readAt.Valid {
			t := readAt.Time
			n.ReadAt = &t
		}

		items = append(items, n)
	}

	return items, rows.Err()
}

func (r *Repository) MarkRead(ctx context.Context, userID, notificationID uuid.UUID) error {
	_, err := r.db.ExecContext(
		ctx,
		`UPDATE notifications
		 SET read_at = COALESCE(read_at, now())
		 WHERE id = $1
		   AND user_id = $2`,
		notificationID,
		userID,
	)
	return err
}

func (r *Repository) MarkAllRead(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.ExecContext(
		ctx,
		`UPDATE notifications
		 SET read_at = now()
		 WHERE user_id = $1
		   AND read_at IS NULL`,
		userID,
	)
	return err
}

func (r *Repository) UnreadCount(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*)::int
		 FROM notifications
		 WHERE user_id = $1
		   AND read_at IS NULL`,
		userID,
	).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}
