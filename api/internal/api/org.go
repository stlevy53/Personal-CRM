package api

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
)

func (s *Server) listSubdivisions(w http.ResponseWriter, r *http.Request) {
	rows, err := s.pool.Query(r.Context(), `SELECT id, name FROM subdivisions ORDER BY name`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []Subdivision{}
	for rows.Next() {
		var sd Subdivision
		if err := rows.Scan(&sd.ID, &sd.Name); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out = append(out, sd)
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) createSubdivision(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var in struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		writeErr(w, http.StatusBadRequest, "name is required")
		return
	}
	var existing Subdivision
	if s.pool.QueryRow(ctx, `SELECT id, name FROM subdivisions WHERE lower(name)=lower($1)`, name).
		Scan(&existing.ID, &existing.Name) == nil {
		writeJSON(w, http.StatusOK, existing)
		return
	}
	id := uniqueID(ctx, s, "subdivisions", slugify(name), fmt.Sprintf("sub-%d", time.Now().UnixNano()))
	if _, err := s.pool.Exec(ctx, `INSERT INTO subdivisions (id, name) VALUES ($1,$2)`, id, name); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(ctx, "Subdivision Created", "Profile", id, name)
	writeJSON(w, http.StatusCreated, Subdivision{ID: id, Name: name})
}

func (s *Server) listStudios(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	where := ""
	args := []any{}
	if sub := r.URL.Query().Get("subdivisionId"); sub != "" {
		where = "WHERE subdivision_id = $1"
		args = append(args, sub)
	}
	rows, err := s.pool.Query(ctx, fmt.Sprintf(`SELECT id, name, subdivision_id FROM studios %s ORDER BY name`, where), args...)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []Studio{}
	for rows.Next() {
		var st Studio
		if err := rows.Scan(&st.ID, &st.Name, &st.SubdivisionID); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out = append(out, st)
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) createStudio(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var in struct {
		Name          string `json:"name"`
		SubdivisionID string `json:"subdivisionId"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	name := strings.TrimSpace(in.Name)
	if name == "" || in.SubdivisionID == "" {
		writeErr(w, http.StatusBadRequest, "name and subdivisionId are required")
		return
	}
	var existing Studio
	if s.pool.QueryRow(ctx,
		`SELECT id, name, subdivision_id FROM studios WHERE lower(name)=lower($1) AND subdivision_id=$2`,
		name, in.SubdivisionID).Scan(&existing.ID, &existing.Name, &existing.SubdivisionID) == nil {
		writeJSON(w, http.StatusOK, existing)
		return
	}
	id := uniqueID(ctx, s, "studios", slugify(name), fmt.Sprintf("studio-%d", time.Now().UnixNano()))
	if _, err := s.pool.Exec(ctx,
		`INSERT INTO studios (id, name, subdivision_id) VALUES ($1,$2,$3)`, id, name, in.SubdivisionID); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(ctx, "Studio Created", "Profile", id, name)
	writeJSON(w, http.StatusCreated, Studio{ID: id, Name: name, SubdivisionID: in.SubdivisionID})
}

func (s *Server) listAppStatuses(w http.ResponseWriter, r *http.Request) {
	rows, err := s.pool.Query(r.Context(), `SELECT key, label, badge FROM app_statuses ORDER BY position, label`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []AppStatus{}
	for rows.Next() {
		var a AppStatus
		if err := rows.Scan(&a.Key, &a.Label, &a.Badge); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out = append(out, a)
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) createAppStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var in struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		writeErr(w, http.StatusBadRequest, "name is required")
		return
	}
	var existing AppStatus
	if s.pool.QueryRow(ctx, `SELECT key, label, badge FROM app_statuses WHERE lower(label)=lower($1)`, name).
		Scan(&existing.Key, &existing.Label, &existing.Badge) == nil {
		writeJSON(w, http.StatusOK, existing)
		return
	}
	key := slugify(name)
	if key == "" {
		key = fmt.Sprintf("status-%d", time.Now().UnixNano())
	}
	var maxPos int
	_ = s.pool.QueryRow(ctx, `SELECT COALESCE(MAX(position),0)+1 FROM app_statuses`).Scan(&maxPos)
	if _, err := s.pool.Exec(ctx,
		`INSERT INTO app_statuses (key, label, badge, position) VALUES ($1,$2,'badge-other',$3)`,
		key, name, maxPos); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(ctx, "App Status Created", "Profile", key, name)
	writeJSON(w, http.StatusCreated, AppStatus{Key: key, Label: name, Badge: "badge-other"})
}

// uniqueID returns base if free in the given table's id column, otherwise
// appends a suffix; falls back to fallback if base is empty.
func uniqueID(ctx context.Context, s *Server, table, base, fallback string) string {
	if base == "" {
		return fallback
	}
	id := base
	for i := 0; i < 50; i++ {
		var exists bool
		q := fmt.Sprintf(`SELECT true FROM %s WHERE id=$1`, table)
		if s.pool.QueryRow(ctx, q, id).Scan(&exists) != nil {
			return id
		}
		id = base + "-x"
		base = id
	}
	return fallback
}
