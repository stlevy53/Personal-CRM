package auth

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/MicahParks/keyfunc/v2"
	"github.com/golang-jwt/jwt/v5"
)

type ctxKey string

const userKey ctxKey = "user"

// User is the authenticated identity extracted from a Acme Auth JWT.
type User struct {
	Subject string
	Email   string
	Name    string
}

// Middleware validates Acme Auth JWTs against a JWKS endpoint. When jwks is
// nil (no JWKS URL configured) it runs in dev-bypass mode: requests pass
// through and are attributed to a synthetic local user.
type Middleware struct {
	jwks     *keyfunc.JWKS
	issuer   string
	audience string
}

// New builds a Middleware. If jwksURL is empty, auth is disabled (dev bypass).
func New(jwksURL, issuer, audience string) (*Middleware, error) {
	if jwksURL == "" {
		return &Middleware{}, nil
	}
	jwks, err := keyfunc.Get(jwksURL, keyfunc.Options{
		RefreshInterval:   time.Hour,
		RefreshUnknownKID: true,
	})
	if err != nil {
		return nil, err
	}
	return &Middleware{jwks: jwks, issuer: issuer, audience: audience}, nil
}

// Enabled reports whether real JWT validation is active.
func (m *Middleware) Enabled() bool { return m.jwks != nil }

// Require wraps a handler, enforcing a valid bearer token unless in dev bypass.
func (m *Middleware) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if m.jwks == nil {
			// Dev bypass: attribute everything to a local user.
			ctx := context.WithValue(r.Context(), userKey, User{
				Subject: "local-dev",
				Email:   "dev@acme.example.com",
				Name:    "Local Dev",
			})
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		authz := r.Header.Get("Authorization")
		if !strings.HasPrefix(authz, "Bearer ") {
			http.Error(w, "missing bearer token", http.StatusUnauthorized)
			return
		}
		raw := strings.TrimPrefix(authz, "Bearer ")

		opts := []jwt.ParserOption{jwt.WithExpirationRequired()}
		if m.issuer != "" {
			opts = append(opts, jwt.WithIssuer(m.issuer))
		}
		if m.audience != "" {
			opts = append(opts, jwt.WithAudience(m.audience))
		}

		token, err := jwt.Parse(raw, m.jwks.Keyfunc, opts...)
		if err != nil || !token.Valid {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		claims, _ := token.Claims.(jwt.MapClaims)
		user := User{
			Subject: stringClaim(claims, "sub"),
			Email:   stringClaim(claims, "email"),
			Name:    stringClaim(claims, "name"),
		}
		ctx := context.WithValue(r.Context(), userKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// FromContext returns the authenticated user, if any.
func FromContext(ctx context.Context) (User, bool) {
	u, ok := ctx.Value(userKey).(User)
	return u, ok
}

// ActorID returns a stable identifier for audit logging.
func ActorID(ctx context.Context) string {
	if u, ok := FromContext(ctx); ok {
		if u.Email != "" {
			return u.Email
		}
		return u.Subject
	}
	return "system"
}

func stringClaim(claims jwt.MapClaims, key string) string {
	if claims == nil {
		return ""
	}
	if v, ok := claims[key].(string); ok {
		return v
	}
	return ""
}
