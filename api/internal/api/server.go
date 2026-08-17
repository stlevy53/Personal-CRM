package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stlevy53/personal-crm/api/internal/auth"
)

// Server holds shared dependencies for HTTP handlers.
type Server struct {
	pool        *pgxpool.Pool
	auth        *auth.Middleware
	corsOrigins map[string]bool
}

func NewServer(pool *pgxpool.Pool, mw *auth.Middleware, corsOrigins []string) *Server {
	origins := make(map[string]bool, len(corsOrigins))
	for _, o := range corsOrigins {
		origins[o] = true
	}
	return &Server{pool: pool, auth: mw, corsOrigins: origins}
}

// Handler builds the routed, CORS-wrapped HTTP handler.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	// Unauthenticated.
	mux.HandleFunc("GET /healthz", s.handleHealth)

	// Authenticated API.
	api := http.NewServeMux()
	api.HandleFunc("GET /api/customers", s.listCustomers)
	api.HandleFunc("POST /api/customers", s.createCustomer)
	api.HandleFunc("GET /api/customers/{id}", s.getCustomer)
	api.HandleFunc("PATCH /api/customers/{id}", s.updateCustomer)
	api.HandleFunc("POST /api/customers/{id}/notes", s.addCustomerNote)

	api.HandleFunc("GET /api/contacts", s.listContacts)
	api.HandleFunc("POST /api/contacts", s.createContact)
	api.HandleFunc("PATCH /api/contacts/{id}", s.updateContact)

	api.HandleFunc("GET /api/interactions", s.listInteractions)
	api.HandleFunc("POST /api/interactions", s.createInteraction)
	api.HandleFunc("GET /api/interactions/{id}", s.getInteraction)
	api.HandleFunc("PATCH /api/interactions/{id}", s.updateInteraction)
	api.HandleFunc("PATCH /api/interactions/{id}/action-items/{index}", s.setActionStatus)

	api.HandleFunc("GET /api/subdivisions", s.listSubdivisions)
	api.HandleFunc("POST /api/subdivisions", s.createSubdivision)
	api.HandleFunc("GET /api/studios", s.listStudios)
	api.HandleFunc("POST /api/studios", s.createStudio)
	api.HandleFunc("GET /api/app-statuses", s.listAppStatuses)
	api.HandleFunc("POST /api/app-statuses", s.createAppStatus)

	api.HandleFunc("GET /api/people", s.listPeople)
	api.HandleFunc("POST /api/people", s.createPerson)
	api.HandleFunc("GET /api/pods", s.listPods)

	api.HandleFunc("GET /api/audit", s.listAudit)
	api.HandleFunc("GET /api/stats", s.getStats)

	mux.Handle("/api/", s.auth.Require(api))

	return s.withCORS(mux)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	if err := s.pool.Ping(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"status": "down", "db": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":      "ok",
		"authEnabled": s.auth.Enabled(),
	})
}

// --- CORS ---

func (s *Server) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && s.corsOrigins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- shared helpers ---

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decodeJSON(r *http.Request, dst any) error {
	if r.Body == nil {
		return fmt.Errorf("empty body")
	}
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}

// audit inserts an audit-log row attributed to the authenticated actor.
func (s *Server) audit(ctx context.Context, action, recordType, recordID, detail string) {
	id := fmt.Sprintf("audit-%d", time.Now().UnixNano())
	_, _ = s.pool.Exec(ctx,
		`INSERT INTO audit_log (id, actor_id, action, record_type, record_id, detail)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		id, auth.ActorID(ctx), action, recordType, recordID, detail)
}
