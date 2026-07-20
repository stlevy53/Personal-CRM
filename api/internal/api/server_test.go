package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func corsServer() *Server {
	return &Server{corsOrigins: map[string]bool{"http://localhost:5173": true}}
}

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
}

func TestWithCORS_AllowedOrigin(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats", nil)
	req.Header.Set("Origin", "http://localhost:5173")

	corsServer().withCORS(okHandler()).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("Allow-Origin = %q; want the allowed origin echoed back", got)
	}
	if rec.Code != http.StatusTeapot {
		t.Fatalf("status = %d; want next handler to run (418)", rec.Code)
	}
}

func TestWithCORS_DisallowedOriginGetsNoHeader(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats", nil)
	req.Header.Set("Origin", "https://evil.example.com")

	corsServer().withCORS(okHandler()).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Allow-Origin = %q; want empty for disallowed origin", got)
	}
}

func TestWithCORS_PreflightShortCircuits(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/api/stats", nil)
	req.Header.Set("Origin", "http://localhost:5173")

	corsServer().withCORS(okHandler()).ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("OPTIONS status = %d; want 204 (preflight should not reach next)", rec.Code)
	}
}

func TestWriteJSON(t *testing.T) {
	rec := httptest.NewRecorder()
	writeJSON(rec, http.StatusCreated, map[string]any{"status": "ok"})

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d; want 201", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("Content-Type = %q; want application/json", ct)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("body not valid JSON: %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("body = %v; want status=ok", body)
	}
}

func TestDecodeJSON_RejectsUnknownFields(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/customers",
		bytes.NewBufferString(`{"name":"Acme","bogus":true}`))

	var dst struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(req, &dst); err == nil {
		t.Fatal("decodeJSON accepted an unknown field; want error (DisallowUnknownFields)")
	} else if !strings.Contains(err.Error(), "bogus") {
		t.Fatalf("error = %v; want it to mention the unknown field", err)
	}
}
