package api

import (
	"fmt"
	"net/http"
	"strings"
	"time"
)

func (s *Server) listContacts(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := s.pool.Query(ctx,
		`SELECT id, name, email, slack, role, COALESCE(customer_id, '')
		 FROM contacts ORDER BY name`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []Contact{}
	for rows.Next() {
		var c Contact
		if err := rows.Scan(&c.ID, &c.Name, &c.Email, &c.Slack, &c.Role, &c.GameTeamID); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type contactInput struct {
	ID         *string `json:"id"`
	Name       *string `json:"name"`
	Email      *string `json:"email"`
	Slack      *string `json:"slack"`
	Role       *string `json:"role"`
	GameTeamID *string `json:"gameTeamId"`
}

func (s *Server) createContact(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var in contactInput
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if in.Name == nil || strings.TrimSpace(*in.Name) == "" {
		writeErr(w, http.StatusBadRequest, "name is required")
		return
	}
	id := fmt.Sprintf("ct-%d", time.Now().UnixNano())
	if in.ID != nil && *in.ID != "" {
		id = *in.ID
	}
	c := Contact{ID: id, Name: strings.TrimSpace(*in.Name)}
	if in.Email != nil {
		c.Email = *in.Email
	}
	if in.Slack != nil {
		c.Slack = *in.Slack
	}
	if in.Role != nil {
		c.Role = *in.Role
	}
	if in.GameTeamID != nil {
		c.GameTeamID = *in.GameTeamID
	}

	var customerID any
	if c.GameTeamID != "" {
		customerID = c.GameTeamID
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO contacts (id, name, email, slack, role, customer_id)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		c.ID, c.Name, c.Email, c.Slack, c.Role, customerID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	detail := c.Name
	if c.GameTeamID != "" {
		var teamName string
		if s.pool.QueryRow(ctx, `SELECT name FROM customers WHERE id=$1`, c.GameTeamID).Scan(&teamName) == nil {
			detail = fmt.Sprintf("%s - %s", c.Name, teamName)
		}
	}
	s.audit(ctx, "Contact Added", "Contact", c.ID, detail)
	writeJSON(w, http.StatusCreated, c)
}

func (s *Server) updateContact(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := r.PathValue("id")
	var in contactInput
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
	if in.Email != nil {
		add("email", *in.Email)
	}
	if in.Slack != nil {
		add("slack", *in.Slack)
	}
	if in.Role != nil {
		add("role", *in.Role)
	}
	if in.GameTeamID != nil {
		var cid any
		if *in.GameTeamID != "" {
			cid = *in.GameTeamID
		}
		add("customer_id", cid)
	}
	if len(sets) == 0 {
		writeErr(w, http.StatusBadRequest, "no fields to update")
		return
	}
	add("updated_at", time.Now())
	args = append(args, id)
	q := fmt.Sprintf("UPDATE contacts SET %s WHERE id = $%d", strings.Join(sets, ", "), n)
	tag, err := s.pool.Exec(ctx, q, args...)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, http.StatusNotFound, "contact not found")
		return
	}

	var c Contact
	err = s.pool.QueryRow(ctx,
		`SELECT id, name, email, slack, role, COALESCE(customer_id,'') FROM contacts WHERE id=$1`, id).
		Scan(&c.ID, &c.Name, &c.Email, &c.Slack, &c.Role, &c.GameTeamID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(ctx, "Contact Updated", "Contact", c.ID, c.Name)
	writeJSON(w, http.StatusOK, c)
}
