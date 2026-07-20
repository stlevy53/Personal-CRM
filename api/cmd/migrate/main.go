// Command migrate applies database migrations. Used as a standalone step in
// CI/CD before deploying a new API version (and available locally).
//
//	migrate up   - apply all pending migrations (default)
package main

import (
	"context"
	"log"
	"os"

	"github.com/stlevy53/personal-crm/api/internal/config"
	"github.com/stlevy53/personal-crm/api/internal/db"
)

func main() {
	cmd := "up"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}

	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	switch cmd {
	case "up":
		if err := db.Migrate(ctx, pool); err != nil {
			log.Fatalf("migrate up: %v", err)
		}
		log.Println("migrations up to date")
	default:
		log.Fatalf("unknown command %q (supported: up)", cmd)
	}
}
