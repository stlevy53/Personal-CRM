package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/stlevy53/personal-crm/api/internal/auth"
)

func (s *Server) listInteractions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	where := ""
	args := []any{}
	if tid := r.URL.Query().Get("gameTeamId"); tid != "" {
		where = "WHERE customer_id = $1"
		args = append(args, tid)
	}
	rows, err := s.pool.Query(ctx, fmt.Sprintf(
		`SELECT id, type, title, date, notes, sentiment, tags, customer_id, logged_by, created_at
		 FROM interactions %s ORDER BY date DESC`, where), args...)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	out := []Interaction{}
	for rows.Next() {
		i, err := scanInteraction(rows)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out = append(out, i)
	}
	if err := rows.Err(); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	for idx := range out {
		if err := s.hydrateInteraction(ctx, &out[idx]); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) getInteraction(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	i, err := s.loadInteraction(ctx, r.PathValue("id"))
	if errors.Is(err, pgx.ErrNoRows) {
		writeErr(w, http.StatusNotFound, "interaction not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, i)
}

func (s *Server) loadInteraction(ctx context.Context, id string) (*Interaction, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, type, title, date, notes, sentiment, tags, customer_id, logged_by, created_at
		 FROM interactions WHERE id = $1`, id)
	i, err := scanInteraction(row)
	if err != nil {
		return nil, err
	}
	if err := s.hydrateInteraction(ctx, &i); err != nil {
		return nil, err
	}
	return &i, nil
}

type scannable interface {
	Scan(dest ...any) error
}

func scanInteraction(row scannable) (Interaction, error) {
	var i Interaction
	err := row.Scan(&i.ID, &i.Type, &i.Title, &i.Date, &i.Notes, &i.Sentiment, &i.Tags,
		&i.GameTeamID, &i.LoggedBy, &i.CreatedAt)
	if i.Tags == nil {
		i.Tags = []string{}
	}
	return i, err
}

func (s *Server) hydrateInteraction(ctx context.Context, i *Interaction) error {
	i.AttendeesMgt = []string{}
	i.AttendeesExternal = []string{}
	i.ActionItems = []ActionItem{}

	zr, err := s.pool.Query(ctx, `SELECT engineer_id FROM interaction_attendees_mgt WHERE interaction_id=$1`, i.ID)
	if err != nil {
		return err
	}
	for zr.Next() {
		var id string
		if err := zr.Scan(&id); err != nil {
			zr.Close()
			return err
		}
		i.AttendeesMgt = append(i.AttendeesMgt, id)
	}
	zr.Close()

	er, err := s.pool.Query(ctx, `SELECT contact_id FROM interaction_attendees_external WHERE interaction_id=$1`, i.ID)
	if err != nil {
		return err
	}
	for er.Next() {
		var id string
		if err := er.Scan(&id); err != nil {
			er.Close()
			return err
		}
		i.AttendeesExternal = append(i.AttendeesExternal, id)
	}
	er.Close()

	ar, err := s.pool.Query(ctx,
		`SELECT text, owner_id, due_date, status FROM action_items
		 WHERE interaction_id=$1 ORDER BY position`, i.ID)
	if err != nil {
		return err
	}
	defer ar.Close()
	for ar.Next() {
		var a ActionItem
		var owner *string
		var due *time.Time
		if err := ar.Scan(&a.Text, &owner, &due, &a.Status); err != nil {
			return err
		}
		a.OwnerID = owner
		if due != nil {
			ds := due.Format("2006-01-02")
			a.DueDate = &ds
		}
		i.ActionItems = append(i.ActionItems, a)
	}
	return ar.Err()
}

type interactionInput struct {
	Type              *string      `json:"type"`
	Title             *string      `json:"title"`
	Date              *string      `json:"date"`
	Notes             *string      `json:"notes"`
	Sentiment         *string      `json:"sentiment"`
	ActionItems       []ActionItem `json:"actionItems"`
	Tags              *[]string    `json:"tags"`
	AttendeesMgt     *[]string    `json:"attendeesMgt"`
	AttendeesExternal *[]string    `json:"attendeesExternal"`
	GameTeamID        *string      `json:"gameTeamId"`
	LoggedBy          *string      `json:"loggedBy"`
}

func (s *Server) createInteraction(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var in interactionInput
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if in.GameTeamID == nil || *in.GameTeamID == "" {
		writeErr(w, http.StatusBadRequest, "gameTeamId is required")
		return
	}

	var next int
	if err := s.pool.QueryRow(ctx,
		`SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\D', '', 'g'), '')::int), 0) + 1
		 FROM interactions WHERE id LIKE 'INTR-%'`).Scan(&next); err != nil {
		next = 1
	}
	id := fmt.Sprintf("INTR-%04d", next)

	typ := "meeting"
	if in.Type != nil && *in.Type != "" {
		typ = *in.Type
	}
	date := time.Now()
	if in.Date != nil && *in.Date != "" {
		if parsed, err := time.Parse(time.RFC3339, *in.Date); err == nil {
			date = parsed
		} else if parsed, err := time.Parse("2006-01-02", *in.Date); err == nil {
			date = parsed
		}
	}
	title := derefOr(in.Title, "")
	notes := derefOr(in.Notes, "")
	sentiment := normalizeSentiment(derefOr(in.Sentiment, "neutral"))
	loggedBy := derefOr(in.LoggedBy, auth.ActorID(ctx))
	tags := derefSlice(in.Tags)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`INSERT INTO interactions (id, type, title, date, notes, sentiment, tags, customer_id, logged_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		id, typ, title, date, notes, sentiment, tags, *in.GameTeamID, loggedBy); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := insertAttendees(ctx, tx, id, derefSlice(in.AttendeesMgt), derefSlice(in.AttendeesExternal)); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := insertActionItems(ctx, tx, id, in.ActionItems); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := tx.Commit(ctx); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	var teamName string
	_ = s.pool.QueryRow(ctx, `SELECT name FROM customers WHERE id=$1`, *in.GameTeamID).Scan(&teamName)
	s.audit(ctx, "Interaction Logged", "Interaction", id, fmt.Sprintf("%s - %s", typ, teamName))

	i, _ := s.loadInteraction(ctx, id)
	writeJSON(w, http.StatusCreated, i)
}

func (s *Server) updateInteraction(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := r.PathValue("id")
	var in interactionInput
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}

	var exists bool
	if err := s.pool.QueryRow(ctx, `SELECT true FROM interactions WHERE id=$1`, id).Scan(&exists); err != nil {
		writeErr(w, http.StatusNotFound, "interaction not found")
		return
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback(ctx)

	sets := []string{}
	args := []any{}
	n := 1
	add := func(col string, val any) {
		sets = append(sets, fmt.Sprintf("%s = $%d", col, n))
		args = append(args, val)
		n++
	}
	if in.Type != nil {
		add("type", *in.Type)
	}
	if in.Title != nil {
		add("title", *in.Title)
	}
	if in.Notes != nil {
		add("notes", *in.Notes)
	}
	if in.Sentiment != nil {
		add("sentiment", normalizeSentiment(*in.Sentiment))
	}
	if in.Tags != nil {
		add("tags", *in.Tags)
	}
	if in.GameTeamID != nil {
		add("customer_id", *in.GameTeamID)
	}
	if in.Date != nil && *in.Date != "" {
		if parsed, err := time.Parse(time.RFC3339, *in.Date); err == nil {
			add("date", parsed)
		} else if parsed, err := time.Parse("2006-01-02", *in.Date); err == nil {
			add("date", parsed)
		}
	}
	if len(sets) > 0 {
		args = append(args, id)
		q := fmt.Sprintf("UPDATE interactions SET %s WHERE id = $%d", join(sets), n)
		if _, err := tx.Exec(ctx, q, args...); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	if in.AttendeesMgt != nil || in.AttendeesExternal != nil {
		if _, err := tx.Exec(ctx, `DELETE FROM interaction_attendees_mgt WHERE interaction_id=$1`, id); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		if _, err := tx.Exec(ctx, `DELETE FROM interaction_attendees_external WHERE interaction_id=$1`, id); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		if err := insertAttendees(ctx, tx, id, derefSlice(in.AttendeesMgt), derefSlice(in.AttendeesExternal)); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	if in.ActionItems != nil {
		if _, err := tx.Exec(ctx, `DELETE FROM action_items WHERE interaction_id=$1`, id); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		if err := insertActionItems(ctx, tx, id, in.ActionItems); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	i, _ := s.loadInteraction(ctx, id)
	s.audit(ctx, "Interaction Updated", "Interaction", id, fmt.Sprintf("%s - %s", i.Type, i.GameTeamID))
	writeJSON(w, http.StatusOK, i)
}

func (s *Server) setActionStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := r.PathValue("id")
	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid index")
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	switch body.Status {
	case "open", "in-progress", "closed":
	default:
		writeErr(w, http.StatusBadRequest, "invalid status")
		return
	}
	tag, err := s.pool.Exec(ctx,
		`UPDATE action_items SET status=$1, updated_at=now()
		 WHERE interaction_id=$2 AND position=$3`, body.Status, id, index)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, http.StatusNotFound, "action item not found")
		return
	}
	s.audit(ctx, "Action Item Updated", "Interaction", id, fmt.Sprintf("item %d -> %s", index, body.Status))
	i, _ := s.loadInteraction(ctx, id)
	writeJSON(w, http.StatusOK, i)
}

// --- helpers ---

func insertAttendees(ctx context.Context, tx pgx.Tx, id string, mgt, external []string) error {
	for _, e := range mgt {
		if _, err := tx.Exec(ctx,
			`INSERT INTO interaction_attendees_mgt (interaction_id, engineer_id)
			 VALUES ($1,$2) ON CONFLICT DO NOTHING`, id, e); err != nil {
			return err
		}
	}
	for _, c := range external {
		if _, err := tx.Exec(ctx,
			`INSERT INTO interaction_attendees_external (interaction_id, contact_id)
			 VALUES ($1,$2) ON CONFLICT DO NOTHING`, id, c); err != nil {
			return err
		}
	}
	return nil
}

func insertActionItems(ctx context.Context, tx pgx.Tx, id string, items []ActionItem) error {
	for pos, a := range items {
		status := a.Status
		switch status {
		case "open", "in-progress", "closed":
		default:
			status = "open"
		}
		var due any
		if a.DueDate != nil && *a.DueDate != "" {
			due = *a.DueDate
		}
		var owner any
		if a.OwnerID != nil && *a.OwnerID != "" {
			owner = *a.OwnerID
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO action_items (interaction_id, position, text, owner_id, due_date, status)
			 VALUES ($1,$2,$3,$4,$5,$6)`,
			id, pos, a.Text, owner, due, status); err != nil {
			return err
		}
	}
	return nil
}

func normalizeSentiment(s string) string {
	switch s {
	case "positive", "neutral", "negative":
		return s
	default:
		return "neutral"
	}
}

func derefOr(p *string, def string) string {
	if p != nil {
		return *p
	}
	return def
}

func derefSlice(p *[]string) []string {
	if p == nil {
		return nil
	}
	return *p
}

func join(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += ", "
		}
		out += p
	}
	return out
}
