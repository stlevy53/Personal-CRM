package seed

import (
	"context"
	_ "embed"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed seed.sql
var seedSQL string

// Run loads the prototype demo dataset, but only if the database is empty
// (no customers). This keeps it idempotent across restarts.
func Run(ctx context.Context, pool *pgxpool.Pool) error {
	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM customers`).Scan(&count); err != nil {
		return fmt.Errorf("check seed state: %w", err)
	}
	if count > 0 {
		return nil
	}
	if _, err := pool.Exec(ctx, seedSQL); err != nil {
		return fmt.Errorf("run seed: %w", err)
	}
	fmt.Println("[seed] loaded prototype demo dataset")
	return nil
}
