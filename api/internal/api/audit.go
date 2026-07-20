package api

import "net/http"

func (s *Server) listAudit(w http.ResponseWriter, r *http.Request) {
	rows, err := s.pool.Query(r.Context(),
		`SELECT id, ts, actor_id, action, record_type, record_id, detail
		 FROM audit_log ORDER BY ts DESC LIMIT 500`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []AuditEntry{}
	for rows.Next() {
		var a AuditEntry
		if err := rows.Scan(&a.ID, &a.Timestamp, &a.ActorID, &a.Action, &a.RecordType, &a.RecordID, &a.Detail); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out = append(out, a)
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) getStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var st Stats
	_ = s.pool.QueryRow(ctx, `SELECT count(*) FROM interactions`).Scan(&st.Interactions)
	_ = s.pool.QueryRow(ctx, `SELECT count(*) FROM customers`).Scan(&st.Teams)
	_ = s.pool.QueryRow(ctx, `SELECT count(*) FROM contacts`).Scan(&st.Contacts)
	_ = s.pool.QueryRow(ctx, `SELECT count(*) FROM interactions WHERE date > now() - interval '30 days'`).Scan(&st.Last30)
	writeJSON(w, http.StatusOK, st)
}
