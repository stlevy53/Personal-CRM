package config

import (
	"os"
	"strings"
)

// Config holds runtime configuration sourced from environment variables.
type Config struct {
	Port        string
	DatabaseURL string
	SeedData    bool
	CORSOrigins []string

	// Acme Auth. If JWKSURL is empty, the API runs with auth disabled (dev bypass).
	AcmeJWKSURL  string
	AcmeIssuer   string
	AcmeAudience string
}

func Load() Config {
	return Config{
		Port:         envOr("PORT", "8080"),
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		SeedData:     envOr("SEED_DATA", "false") == "true",
		CORSOrigins:  splitNonEmpty(envOr("CORS_ORIGINS", "http://localhost:5173")),
		AcmeJWKSURL:  os.Getenv("ACME_AUTH_JWKS_URL"),
		AcmeIssuer:   os.Getenv("ACME_AUTH_ISSUER"),
		AcmeAudience: os.Getenv("ACME_AUTH_AUDIENCE"),
	}
}

// AuthEnabled reports whether JWT validation should be enforced.
func (c Config) AuthEnabled() bool { return c.AcmeJWKSURL != "" }

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func splitNonEmpty(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
