package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNew_DevBypassWhenNoJWKS(t *testing.T) {
	m, err := New("", "", "")
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if m.Enabled() {
		t.Fatal("Enabled() = true; want false when no JWKS URL configured")
	}
}

func TestRequire_DevBypassAttributesLocalUser(t *testing.T) {
	m, _ := New("", "", "")

	var gotActor string
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotActor = ActorID(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	rec := httptest.NewRecorder()
	m.Require(next).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/customers", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; want 200 (dev bypass should pass through)", rec.Code)
	}
	if gotActor != "dev@acme.example.com" {
		t.Fatalf("ActorID = %q; want dev@acme.example.com", gotActor)
	}
}

func TestActorID(t *testing.T) {
	cases := []struct {
		name string
		ctx  context.Context
		want string
	}{
		{"no user", context.Background(), "system"},
		{"email wins", context.WithValue(context.Background(), userKey, User{Subject: "s", Email: "a@b.com"}), "a@b.com"},
		{"subject fallback", context.WithValue(context.Background(), userKey, User{Subject: "sub-123"}), "sub-123"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ActorID(tc.ctx); got != tc.want {
				t.Fatalf("ActorID = %q; want %q", got, tc.want)
			}
		})
	}
}
