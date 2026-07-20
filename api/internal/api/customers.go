package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = slugRe.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if len(s) > 24 {
		s = s[:24]
	}
	return s
}

func (s *Server) listCustomers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := s.pool.Query(ctx,
		`SELECT id, name, studio_id, app_status, slack_channel, services
		 FROM customers ORDER BY name`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	out := []Customer{}
	for rows.Next() {
		var c Customer
		if err := rows.Scan(&c.ID, &c.Name, &c.StudioID, &c.AppStatus, &c.SlackChannel, &c.Services); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	for i := range out {
		if err := s.hydrateCustomer(ctx, &out[i]); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) getCustomer(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	c, err := s.loadCustomer(ctx, r.PathValue("id"))
	if errors.Is(err, pgx.ErrNoRows) {
		writeErr(w, http.StatusNotFound, "customer not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (s *Server) loadCustomer(ctx context.Context, id string) (*Customer, error) {
	var c Customer
	err := s.pool.QueryRow(ctx,
		`SELECT id, name, studio_id, app_status, slack_channel, services
		 FROM customers WHERE id = $1`, id).
		Scan(&c.ID, &c.Name, &c.StudioID, &c.AppStatus, &c.SlackChannel, &c.Services)
	if err != nil {
		return nil, err
	}
	if err := s.hydrateCustomer(ctx, &c); err != nil {
		return nil, err
	}
	return &c, nil
}

// hydrateCustomer fills contact ids and notes.
func (s *Server) hydrateCustomer(ctx context.Context, c *Customer) error {
	c.Services = nonNilStrings(c.Services)
	c.Contacts = []string{}
	c.Notes = []TeamNote{}

	rows, err := s.pool.Query(ctx, `SELECT id FROM contacts WHERE customer_id = $1 ORDER BY name`, c.ID)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		c.Contacts = append(c.Contacts, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	nrows, err := s.pool.Query(ctx,
		`SELECT id, author_id, text, created_at FROM team_notes
		 WHERE customer_id = $1 ORDER BY created_at DESC`, c.ID)
	if err != nil {
		return err
	}
	defer nrows.Close()
	for nrows.Next() {
		var n TeamNote
		if err := nrows.Scan(&n.ID, &n.AuthorID, &n.Text, &n.CreatedAt); err != nil {
			return err
		}
		c.Notes = append(c.Notes, n)
	}
	return nrows.Err()
}

type customerInput struct {
	ID           *string   `json:"id"`
	Name         *string   `json:"name"`
	StudioID     *string   `json:"studioId"`
	AppStatus    *string   `json:"appStatus"`
	SlackChannel *string   `json:"slackChannel"`
	Services     *[]string `json:"services"`
}

func (s *Server) createCustomer(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var in customerInput
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if in.Name == nil || strings.TrimSpace(*in.Name) == "" {
		writeErr(w, http.StatusBadRequest, "name is required")
		return
	}
	id := ""
	if in.ID != nil {
		id = *in.ID
	}
	if id == "" {
		id = slugify(*in.Name)
	}
	if id == "" {
		id = fmt.Sprintf("cust-%d", time.Now().UnixNano())
	}

	// Idempotent: return existing on id clash.
	if existing, err := s.loadCustomer(ctx, id); err == nil {
		writeJSON(w, http.StatusOK, existing)
		return
	}

	studioID := ""
	if in.StudioID != nil {
		studioID = *in.StudioID
	}
	if studioID == "" {
		_ = s.pool.QueryRow(ctx, `SELECT id FROM studios ORDER BY name LIMIT 1`).Scan(&studioID)
	}
	appStatus := "pre-production"
	if in.AppStatus != nil && *in.AppStatus != "" {
		appStatus = *in.AppStatus
	}
	services := []string{}
	if in.Services != nil {
		services = *in.Services
	}
	slack := ""
	if in.SlackChannel != nil {
		slack = *in.SlackChannel
	}

	_, err := s.pool.Exec(ctx,
		`INSERT INTO customers (id, name, studio_id, app_status, slack_channel, services)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		id, strings.TrimSpace(*in.Name), studioID, appStatus, slack, services)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(ctx, "Customer Created", "Profile", id, fmt.Sprintf("Customer profile created - %s", *in.Name))

	c, _ := s.loadCustomer(ctx, id)
	writeJSON(w, http.StatusCreated, c)
}

func (s *Server) updateCustomer(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := r.PathValue("id")
	var in customerInput
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}

	sets := []string{}
	args := []any{}
	n := 1
	add := func(col string, val any) {
		sets = append(sets, fmt.Sprintf("%s = $%d", col, n))
		args = append(args, val)
		n++
	}
	if in.Name != nil {
		add("name", *in.Name)
	}
	if in.StudioID != nil {
		add("studio_id", *in.StudioID)
	}
	if in.AppStatus != nil {
		add("app_status", *in.AppStatus)
	}
	if in.SlackChannel != nil {
		add("slack_channel", *in.SlackChannel)
	}
	if in.Services != nil {
		add("services", *in.Services)
	}
	if len(sets) == 0 {
		c, err := s.loadCustomer(ctx, id)
		if err != nil {
			writeErr(w, http.StatusNotFound, "customer not found")
			return
		}
		writeJSON(w, http.StatusOK, c)
		return
	}
	add("updated_at", time.Now())
	args = append(args, id)
	q := fmt.Sprintf("UPDATE customers SET %s WHERE id = $%d", strings.Join(sets, ", "), n)
	tag, err := s.pool.Exec(ctx, q, args...)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, http.StatusNotFound, "customer not found")
		return
	}
	c, _ := s.loadCustomer(ctx, id)
	s.audit(ctx, "Customer Updated", "Profile", id, c.Name)
	writeJSON(w, http.StatusOK, c)
}

type noteInput struct {
	Text     string `json:"text"`
	AuthorID string `json:"authorId"`
}

func (s *Server) addCustomerNote(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := r.PathValue("id")
	var in noteInput
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(in.Text) == "" {
		writeErr(w, http.StatusBadRequest, "text is required")
		return
	}

	var name string
	if err := s.pool.QueryRow(ctx, `SELECT name FROM customers WHERE id = $1`, id).Scan(&name); err != nil {
		writeErr(w, http.StatusNotFound, "customer not found")
		return
	}

	noteID := fmt.Sprintf("tn-%d", time.Now().UnixNano())
	_, err := s.pool.Exec(ctx,
		`INSERT INTO team_notes (id, customer_id, author_id, text) VALUES ($1,$2,$3,$4)`,
		noteID, id, in.AuthorID, in.Text)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(ctx, "Team Note Added", "Profile", id, fmt.Sprintf("Note added to %s", name))

	c, _ := s.loadCustomer(ctx, id)
	writeJSON(w, http.StatusCreated, c)
}

func nonNilStrings(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
