package chats

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	ErrForbidden    = errors.New("forbidden")
	ErrInvalidInput = errors.New("invalid input")
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) UpsertPresence(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.ExecContext(
		ctx,
		`INSERT INTO chat_user_presence (user_id, last_seen)
		 VALUES ($1, now())
		 ON CONFLICT (user_id)
		 DO UPDATE SET last_seen = EXCLUDED.last_seen`,
		userID,
	)
	return err
}

func (r *Repository) ListUsers(ctx context.Context, requesterID uuid.UUID, limit int) ([]UserItem, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	rows, err := r.db.QueryContext(
		ctx,
		`SELECT
			u.id::text,
			u.email,
			u.full_name,
			u.avatar_url,
			u.role,
			d.name,
			COALESCE(cp.last_seen > now() - INTERVAL '60 seconds', false) AS online,
			cp.last_seen,
			dt.thread_id::text,
			lm.text,
			lm.attachment_type,
			lm.created_at,
			lm.sender_id::text
		FROM users u
		LEFT JOIN departments d ON d.id = u.department_id
		LEFT JOIN chat_user_presence cp ON cp.user_id = u.id
		LEFT JOIN chat_direct_threads dt
			ON (dt.user_a_id = $1 AND dt.user_b_id = u.id)
			OR (dt.user_b_id = $1 AND dt.user_a_id = u.id)
		LEFT JOIN LATERAL (
			SELECT m.text, m.attachment_type, m.created_at, m.sender_id
			FROM chat_messages m
			WHERE m.thread_id = dt.thread_id
			ORDER BY m.created_at DESC
			LIMIT 1
		) lm ON true
		WHERE u.id <> $1
		ORDER BY online DESC, COALESCE(lm.created_at, cp.last_seen, u.created_at) DESC, u.email ASC
		LIMIT $2`,
		requesterID,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]UserItem, 0)
	for rows.Next() {
		var (
			item                UserItem
			idRaw               string
			fullName            sql.NullString
			avatarURL           sql.NullString
			threadIDRaw         sql.NullString
			lastSeen            sql.NullTime
			lastMessage         sql.NullString
			lastMessageType     sql.NullString
			lastMessageAt       sql.NullTime
			lastMessageSenderID sql.NullString
		)

		if err := rows.Scan(
			&idRaw,
			&item.Email,
			&fullName,
			&avatarURL,
			&item.Role,
			&item.DepartmentName,
			&item.Online,
			&lastSeen,
			&threadIDRaw,
			&lastMessage,
			&lastMessageType,
			&lastMessageAt,
			&lastMessageSenderID,
		); err != nil {
			return nil, err
		}

		parsedID, err := uuid.Parse(idRaw)
		if err != nil {
			return nil, err
		}
		item.ID = parsedID
		item.FullName = nullableString(fullName)
		item.AvatarURL = nullableString(avatarURL)
		item.ThreadID = parseNullableUUID(threadIDRaw)
		if lastSeen.Valid {
			item.LastSeen = &lastSeen.Time
		}
		item.LastMessage = buildPreview(lastMessage, lastMessageType)
		if lastMessageType.Valid {
			value := strings.TrimSpace(lastMessageType.String)
			if value != "" {
				item.LastMessageType = &value
			}
		}
		if lastMessageAt.Valid {
			item.LastMessageAt = &lastMessageAt.Time
		}
		item.LastMessageSender = parseNullableUUID(lastMessageSenderID)

		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *Repository) EnsureDirectThread(ctx context.Context, requesterID, targetUserID uuid.UUID) (ThreadItem, error) {
	if requesterID == targetUserID {
		return ThreadItem{}, ErrInvalidInput
	}

	var targetExists bool
	if err := r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)`, targetUserID).Scan(&targetExists); err != nil {
		return ThreadItem{}, err
	}
	if !targetExists {
		return ThreadItem{}, sql.ErrNoRows
	}

	userA, userB := orderedUsers(requesterID, targetUserID)

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return ThreadItem{}, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var threadIDRaw string
	err = tx.QueryRowContext(
		ctx,
		`SELECT thread_id::text
		 FROM chat_direct_threads
		 WHERE user_a_id = $1 AND user_b_id = $2`,
		userA,
		userB,
	).Scan(&threadIDRaw)
	if err == nil {
		if err := ensureMemberRows(ctx, tx, threadIDRaw, requesterID, targetUserID); err != nil {
			return ThreadItem{}, err
		}
		if err := tx.Commit(); err != nil {
			return ThreadItem{}, err
		}
		threadID, parseErr := uuid.Parse(threadIDRaw)
		if parseErr != nil {
			return ThreadItem{}, parseErr
		}
		return r.GetThread(ctx, requesterID, threadID)
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return ThreadItem{}, err
	}

	var newThreadIDRaw string
	if err := tx.QueryRowContext(
		ctx,
		`INSERT INTO chat_threads (is_group, created_by)
		 VALUES (false, $1)
		 RETURNING id::text`,
		requesterID,
	).Scan(&newThreadIDRaw); err != nil {
		return ThreadItem{}, err
	}

	var mappedThreadIDRaw sql.NullString
	if err := tx.QueryRowContext(
		ctx,
		`INSERT INTO chat_direct_threads (user_a_id, user_b_id, thread_id)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (user_a_id, user_b_id)
		 DO NOTHING
		 RETURNING thread_id::text`,
		userA,
		userB,
		newThreadIDRaw,
	).Scan(&mappedThreadIDRaw); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return ThreadItem{}, err
	}

	threadIDForMembers := newThreadIDRaw
	if !mappedThreadIDRaw.Valid {
		if err := tx.QueryRowContext(
			ctx,
			`SELECT thread_id::text
			 FROM chat_direct_threads
			 WHERE user_a_id = $1 AND user_b_id = $2`,
			userA,
			userB,
		).Scan(&threadIDForMembers); err != nil {
			return ThreadItem{}, err
		}

		_, _ = tx.ExecContext(ctx, `DELETE FROM chat_threads WHERE id::text = $1`, newThreadIDRaw)
	}

	if err := ensureMemberRows(ctx, tx, threadIDForMembers, requesterID, targetUserID); err != nil {
		return ThreadItem{}, err
	}

	if err := tx.Commit(); err != nil {
		return ThreadItem{}, err
	}

	threadID, err := uuid.Parse(threadIDForMembers)
	if err != nil {
		return ThreadItem{}, err
	}
	return r.GetThread(ctx, requesterID, threadID)
}

func (r *Repository) CreateGroupThread(ctx context.Context, requesterID uuid.UUID, name string, memberIDs []uuid.UUID) (ThreadItem, error) {
	title := strings.TrimSpace(name)
	if title == "" {
		return ThreadItem{}, ErrInvalidInput
	}
	if len(memberIDs) < 2 {
		return ThreadItem{}, ErrInvalidInput
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return ThreadItem{}, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	for _, memberID := range memberIDs {
		var exists bool
		if err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)`, memberID).Scan(&exists); err != nil {
			return ThreadItem{}, err
		}
		if !exists {
			return ThreadItem{}, sql.ErrNoRows
		}
	}

	var threadIDRaw string
	if err := tx.QueryRowContext(
		ctx,
		`INSERT INTO chat_threads (is_group, title, created_by)
		 VALUES (true, $1, $2)
		 RETURNING id::text`,
		title,
		requesterID,
	).Scan(&threadIDRaw); err != nil {
		return ThreadItem{}, err
	}

	allMembers := make([]uuid.UUID, 0, len(memberIDs)+1)
	allMembers = append(allMembers, requesterID)
	allMembers = append(allMembers, memberIDs...)

	if err := ensureMemberRows(ctx, tx, threadIDRaw, allMembers...); err != nil {
		return ThreadItem{}, err
	}

	if err := tx.Commit(); err != nil {
		return ThreadItem{}, err
	}

	threadID, err := uuid.Parse(threadIDRaw)
	if err != nil {
		return ThreadItem{}, err
	}
	return r.GetThread(ctx, requesterID, threadID)
}

func (r *Repository) RenameThread(ctx context.Context, requesterID, threadID uuid.UUID, name string) (ThreadItem, error) {
	title := strings.TrimSpace(name)
	if title == "" {
		return ThreadItem{}, ErrInvalidInput
	}

	var isGroup bool
	if err := r.db.QueryRowContext(
		ctx,
		`SELECT t.is_group
		 FROM chat_threads t
		 JOIN chat_thread_members me ON me.thread_id = t.id
		 WHERE t.id = $1 AND me.user_id = $2`,
		threadID,
		requesterID,
	).Scan(&isGroup); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ThreadItem{}, ErrForbidden
		}
		return ThreadItem{}, err
	}

	if !isGroup {
		return ThreadItem{}, ErrInvalidInput
	}

	if _, err := r.db.ExecContext(
		ctx,
		`UPDATE chat_threads
		 SET title = $1,
		     updated_at = now()
		 WHERE id = $2`,
		title,
		threadID,
	); err != nil {
		return ThreadItem{}, err
	}

	return r.GetThread(ctx, requesterID, threadID)
}

func (r *Repository) ListThreads(ctx context.Context, userID uuid.UUID, limit int) ([]ThreadItem, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	rows, err := r.db.QueryContext(
		ctx,
		`SELECT
			t.id::text,
			t.title,
			t.avatar_url,
			t.is_group,
			p.user_id::text,
			p.email,
			p.full_name,
			p.avatar_url AS partner_avatar_url,
			p.role,
			p.department_name,
			COALESCE(cp.last_seen > now() - INTERVAL '60 seconds', false) AS online,
			m.text,
			m.attachment_type,
			m.created_at,
			m.sender_id::text,
			t.updated_at
		FROM chat_thread_members me
		JOIN chat_threads t ON t.id = me.thread_id
		LEFT JOIN LATERAL (
			SELECT
				tm.user_id,
				u.email,
				u.full_name,
				u.avatar_url,
				u.role,
				d.name AS department_name
			FROM chat_thread_members tm
			JOIN users u ON u.id = tm.user_id
			LEFT JOIN departments d ON d.id = u.department_id
			WHERE tm.thread_id = t.id
			  AND tm.user_id <> $1
			ORDER BY tm.joined_at ASC
			LIMIT 1
		) p ON true
		LEFT JOIN chat_user_presence cp ON cp.user_id = p.user_id
		LEFT JOIN LATERAL (
			SELECT text, attachment_type, created_at, sender_id
			FROM chat_messages
			WHERE thread_id = t.id
			ORDER BY created_at DESC
			LIMIT 1
		) m ON true
		WHERE me.user_id = $1
		ORDER BY COALESCE(m.created_at, t.updated_at) DESC
		LIMIT $2`,
		userID,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ThreadItem, 0)
	for rows.Next() {
		item, err := scanThread(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *Repository) UnreadCount(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*)::int
		 FROM chat_messages m
		 JOIN chat_thread_members me ON me.thread_id = m.thread_id
		 WHERE me.user_id = $1
		   AND m.sender_id <> $1
		   AND m.created_at > COALESCE(me.last_read_at, 'epoch'::timestamptz)`,
		userID,
	).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (r *Repository) GetThread(ctx context.Context, userID, threadID uuid.UUID) (ThreadItem, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT
			t.id::text,
			t.title,
			t.avatar_url,
			t.is_group,
			p.user_id::text,
			p.email,
			p.full_name,
			p.avatar_url AS partner_avatar_url,
			p.role,
			p.department_name,
			COALESCE(cp.last_seen > now() - INTERVAL '60 seconds', false) AS online,
			m.text,
			m.attachment_type,
			m.created_at,
			m.sender_id::text,
			t.updated_at
		FROM chat_threads t
		JOIN chat_thread_members me ON me.thread_id = t.id AND me.user_id = $1
		LEFT JOIN LATERAL (
			SELECT
				tm.user_id,
				u.email,
				u.full_name,
				u.avatar_url,
				u.role,
				d.name AS department_name
			FROM chat_thread_members tm
			JOIN users u ON u.id = tm.user_id
			LEFT JOIN departments d ON d.id = u.department_id
			WHERE tm.thread_id = t.id
			  AND tm.user_id <> $1
			ORDER BY tm.joined_at ASC
			LIMIT 1
		) p ON true
		LEFT JOIN chat_user_presence cp ON cp.user_id = p.user_id
		LEFT JOIN LATERAL (
			SELECT text, attachment_type, created_at, sender_id
			FROM chat_messages
			WHERE thread_id = t.id
			ORDER BY created_at DESC
			LIMIT 1
		) m ON true
		WHERE t.id = $2`,
		userID,
		threadID,
	)

	item, err := scanThread(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ThreadItem{}, ErrForbidden
		}
		return ThreadItem{}, err
	}
	return item, nil
}

func (r *Repository) ListMessages(ctx context.Context, userID, threadID uuid.UUID, limit int, before *time.Time) ([]Message, error) {
	if limit <= 0 || limit > 200 {
		limit = 80
	}

	var allowed bool
	if err := r.db.QueryRowContext(
		ctx,
		`SELECT EXISTS(
			SELECT 1
			FROM chat_thread_members
			WHERE thread_id = $1 AND user_id = $2
		)`,
		threadID,
		userID,
	).Scan(&allowed); err != nil {
		return nil, err
	}
	if !allowed {
		return nil, ErrForbidden
	}

	rows, err := r.db.QueryContext(
		ctx,
		`SELECT
			id::text,
			thread_id::text,
			sender_id::text,
			NULLIF(BTRIM(text), ''),
			NULLIF(BTRIM(attachment_url), ''),
			NULLIF(BTRIM(attachment_type), ''),
			NULLIF(BTRIM(attachment_name), ''),
			created_at
		FROM chat_messages
		WHERE thread_id = $1
		  AND ($2::timestamptz IS NULL OR created_at < $2)
		ORDER BY created_at DESC
		LIMIT $3`,
		threadID,
		before,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Message, 0)
	for rows.Next() {
		var (
			idRaw          string
			threadIDRaw    string
			senderIDRaw    string
			text           sql.NullString
			attachmentURL  sql.NullString
			attachmentType sql.NullString
			attachmentName sql.NullString
			createdAt      time.Time
		)

		if err := rows.Scan(
			&idRaw,
			&threadIDRaw,
			&senderIDRaw,
			&text,
			&attachmentURL,
			&attachmentType,
			&attachmentName,
			&createdAt,
		); err != nil {
			return nil, err
		}

		id, err := uuid.Parse(idRaw)
		if err != nil {
			return nil, err
		}
		parsedThreadID, err := uuid.Parse(threadIDRaw)
		if err != nil {
			return nil, err
		}
		senderID, err := uuid.Parse(senderIDRaw)
		if err != nil {
			return nil, err
		}

		message := Message{
			ID:        id,
			ThreadID:  parsedThreadID,
			SenderID:  senderID,
			CreatedAt: createdAt,
		}

		if text.Valid {
			value := strings.TrimSpace(text.String)
			if value != "" {
				message.Text = &value
			}
		}
		if attachmentURL.Valid {
			value := strings.TrimSpace(attachmentURL.String)
			if value != "" {
				message.AttachmentURL = &value
			}
		}
		if attachmentType.Valid {
			value := strings.TrimSpace(attachmentType.String)
			if value != "" {
				message.AttachmentType = &value
			}
		}
		if attachmentName.Valid {
			value := strings.TrimSpace(attachmentName.String)
			if value != "" {
				message.AttachmentName = &value
			}
		}

		out = append(out, message)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// reverse to ascending timeline for client rendering
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}

	_, _ = r.db.ExecContext(
		ctx,
		`UPDATE chat_thread_members
		 SET last_read_at = now()
		 WHERE thread_id = $1 AND user_id = $2`,
		threadID,
		userID,
	)

	return out, nil
}

func (r *Repository) AppendMessage(ctx context.Context, userID, threadID uuid.UUID, text, attachmentURL, attachmentType, attachmentName *string) (Message, error) {
	var allowed bool
	if err := r.db.QueryRowContext(
		ctx,
		`SELECT EXISTS(
			SELECT 1
			FROM chat_thread_members
			WHERE thread_id = $1 AND user_id = $2
		)`,
		threadID,
		userID,
	).Scan(&allowed); err != nil {
		return Message{}, err
	}
	if !allowed {
		return Message{}, ErrForbidden
	}

	normText := normalizeNullableText(text)
	normAttachmentURL := normalizeNullableText(attachmentURL)
	normAttachmentType := normalizeNullableText(attachmentType)
	normAttachmentName := normalizeNullableText(attachmentName)

	if normText == nil && normAttachmentURL == nil {
		return Message{}, ErrInvalidInput
	}

	var (
		idRaw         string
		threadIDRaw   string
		senderIDRaw   string
		outText       sql.NullString
		outAttachURL  sql.NullString
		outAttachType sql.NullString
		outAttachName sql.NullString
		createdAt     time.Time
	)

	err := r.db.QueryRowContext(
		ctx,
		`INSERT INTO chat_messages (
			thread_id,
			sender_id,
			text,
			attachment_url,
			attachment_type,
			attachment_name
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING
			id::text,
			thread_id::text,
			sender_id::text,
			NULLIF(BTRIM(text), ''),
			NULLIF(BTRIM(attachment_url), ''),
			NULLIF(BTRIM(attachment_type), ''),
			NULLIF(BTRIM(attachment_name), ''),
			created_at`,
		threadID,
		userID,
		normText,
		normAttachmentURL,
		normAttachmentType,
		normAttachmentName,
	).Scan(
		&idRaw,
		&threadIDRaw,
		&senderIDRaw,
		&outText,
		&outAttachURL,
		&outAttachType,
		&outAttachName,
		&createdAt,
	)
	if err != nil {
		return Message{}, err
	}

	_, _ = r.db.ExecContext(ctx, `UPDATE chat_threads SET updated_at = now() WHERE id = $1`, threadID)
	_, _ = r.db.ExecContext(
		ctx,
		`UPDATE chat_thread_members
		 SET last_read_at = now()
		 WHERE thread_id = $1 AND user_id = $2`,
		threadID,
		userID,
	)

	id, err := uuid.Parse(idRaw)
	if err != nil {
		return Message{}, err
	}
	parsedThreadID, err := uuid.Parse(threadIDRaw)
	if err != nil {
		return Message{}, err
	}
	senderID, err := uuid.Parse(senderIDRaw)
	if err != nil {
		return Message{}, err
	}

	message := Message{
		ID:        id,
		ThreadID:  parsedThreadID,
		SenderID:  senderID,
		CreatedAt: createdAt,
	}
	if outText.Valid {
		value := strings.TrimSpace(outText.String)
		if value != "" {
			message.Text = &value
		}
	}
	if outAttachURL.Valid {
		value := strings.TrimSpace(outAttachURL.String)
		if value != "" {
			message.AttachmentURL = &value
		}
	}
	if outAttachType.Valid {
		value := strings.TrimSpace(outAttachType.String)
		if value != "" {
			message.AttachmentType = &value
		}
	}
	if outAttachName.Valid {
		value := strings.TrimSpace(outAttachName.String)
		if value != "" {
			message.AttachmentName = &value
		}
	}

	return message, nil
}

func (r *Repository) ListThreadMemberIDs(ctx context.Context, requesterID, threadID uuid.UUID) ([]uuid.UUID, error) {
	var allowed bool
	if err := r.db.QueryRowContext(
		ctx,
		`SELECT EXISTS(
			SELECT 1
			FROM chat_thread_members
			WHERE thread_id = $1 AND user_id = $2
		)`,
		threadID,
		requesterID,
	).Scan(&allowed); err != nil {
		return nil, err
	}
	if !allowed {
		return nil, ErrForbidden
	}

	rows, err := r.db.QueryContext(
		ctx,
		`SELECT user_id::text
		 FROM chat_thread_members
		 WHERE thread_id = $1`,
		threadID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]uuid.UUID, 0)
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		parsed, err := uuid.Parse(raw)
		if err != nil {
			return nil, err
		}
		out = append(out, parsed)
	}

	return out, rows.Err()
}

type threadScanner interface {
	Scan(dest ...any) error
}

func scanThread(scanner threadScanner) (ThreadItem, error) {
	var (
		item              ThreadItem
		idRaw             string
		title             sql.NullString
		partnerIDRaw      sql.NullString
		partnerEmail      sql.NullString
		partnerFullName   sql.NullString
		partnerAvatarURL  sql.NullString
		lastMessage       sql.NullString
		lastMessageType   sql.NullString
		lastMessageAt     sql.NullTime
		lastMessageSender sql.NullString
	)

	if err := scanner.Scan(
		&idRaw,
		&title,
		&item.AvatarURL,
		&item.IsGroup,
		&partnerIDRaw,
		&partnerEmail,
		&partnerFullName,
		&partnerAvatarURL,
		&item.PartnerRole,
		&item.PartnerDepartment,
		&item.Online,
		&lastMessage,
		&lastMessageType,
		&lastMessageAt,
		&lastMessageSender,
		&item.UpdatedAt,
	); err != nil {
		return ThreadItem{}, err
	}

	parsedID, err := uuid.Parse(idRaw)
	if err != nil {
		return ThreadItem{}, err
	}
	item.ID = parsedID
	item.PartnerID = parseNullableUUID(partnerIDRaw)
	item.PartnerEmail = nullableString(partnerEmail)
	item.PartnerFullName = nullableString(partnerFullName)
	item.PartnerAvatarURL = nullableString(partnerAvatarURL)
	item.LastMessage = buildPreview(lastMessage, lastMessageType)
	if lastMessageType.Valid {
		value := strings.TrimSpace(lastMessageType.String)
		if value != "" {
			item.LastMessageType = &value
		}
	}
	if lastMessageAt.Valid {
		item.LastMessageAt = &lastMessageAt.Time
	}
	item.LastMessageSender = parseNullableUUID(lastMessageSender)

	if item.IsGroup {
		if title.Valid && strings.TrimSpace(title.String) != "" {
			value := strings.TrimSpace(title.String)
			item.Name = value
		} else {
			item.Name = "Групповой чат"
		}
	} else if item.PartnerEmail != nil && strings.TrimSpace(*item.PartnerEmail) != "" {
		item.Name = strings.TrimSpace(*item.PartnerEmail)
	} else if title.Valid && strings.TrimSpace(title.String) != "" {
		item.Name = strings.TrimSpace(title.String)
	} else {
		item.Name = "Чат"
	}

	return item, nil
}

func ensureMemberRows(ctx context.Context, tx *sql.Tx, threadIDRaw string, userIDs ...uuid.UUID) error {
	for _, userID := range userIDs {
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO chat_thread_members (thread_id, user_id, joined_at)
			 VALUES ($1, $2, now())
			 ON CONFLICT (thread_id, user_id)
			 DO NOTHING`,
			threadIDRaw,
			userID,
		); err != nil {
			return err
		}
	}
	return nil
}

func orderedUsers(a, b uuid.UUID) (uuid.UUID, uuid.UUID) {
	if strings.Compare(a.String(), b.String()) < 0 {
		return a, b
	}
	return b, a
}

func parseNullableUUID(raw sql.NullString) *uuid.UUID {
	if !raw.Valid {
		return nil
	}

	value := strings.TrimSpace(raw.String)
	if value == "" {
		return nil
	}

	parsed, err := uuid.Parse(value)
	if err != nil {
		return nil
	}
	return &parsed
}

func nullableString(raw sql.NullString) *string {
	if !raw.Valid {
		return nil
	}
	value := strings.TrimSpace(raw.String)
	if value == "" {
		return nil
	}
	return &value
}

func buildPreview(text sql.NullString, attachmentType sql.NullString) *string {
	if text.Valid {
		value := strings.TrimSpace(text.String)
		if value != "" {
			return &value
		}
	}

	if attachmentType.Valid {
		switch strings.ToLower(strings.TrimSpace(attachmentType.String)) {
		case "image":
			value := "[Фото]"
			return &value
		case "video":
			value := "[Видео]"
			return &value
		default:
			value := "[Файл]"
			return &value
		}
	}

	return nil
}

func normalizeNullableText(value *string) *string {
	if value == nil {
		return nil
	}
	normalized := strings.TrimSpace(*value)
	if normalized == "" {
		return nil
	}
	return &normalized
}
