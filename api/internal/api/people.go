package api

import (
	"fmt"
	"net/http"
	"strings"
	"time"
)

func (s *Server) listPeople(w http.ResponseWriter, r *http.Request) {
	rows, err := s.pool.Query(r.Context(),
		`SELECT id, name, initials, COALESCE(pod_id,'') FROM engineers ORDER BY name`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []Person{}
	for rows.Next() {
		var p Person
		if err := rows.Scan(&p.ID, &p.Name, &p.Initials, &p.PodID); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out = append(out, p)
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) createPerson(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var in struct {
		ID       *string `json:"id"`
		Name     string  `json:"name"`
		Initials *string `json:"initials"`
		PodID    *string `json:"podId"`
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
	id := fmt.Sprintf("eng-%d", time.Now().UnixNano())
	if in.ID != nil && *in.ID != "" {
		id = *in.ID
	}
	initials := ""
	if in.Initials != nil {
		initials = *in.Initials
	}
	if initials == "" {
		for _, part := range strings.Fields(name) {
			if len(part) > 0 {
				initials += strings.ToUpper(part[:1])
			}
		}
		if len(initials) > 2 {
			initials = initials[:2]
		}
	}
	var podID any
	if in.PodID != nil && *in.PodID != "" {
		podID = *in.PodID
	}
	if _, err := s.pool.Exec(ctx,
		`INSERT INTO engineers (id, name, initials, pod_id) VALUES ($1,$2,$3,$4)`,
		id, name, initials, podID); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(ctx, "Person Added", "Person", id, name)
	p := Person{ID: id, Name: name, Initials: initials}
	if in.PodID != nil {
		p.PodID = *in.PodID
	}
	writeJSON(w, http.StatusCreated, p)
}

func (s *Server) listPods(w http.ResponseWriter, r *http.Request) {
	rows, err := s.pool.Query(r.Context(), `SELECT id, name FROM pods ORDER BY name`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []Pod{}
	for rows.Next() {
		var p Pod
		if err := rows.Scan(&p.ID, &p.Name); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out = append(out, p)
	}
	writeJSON(w, http.StatusOK, out)
}
