package db

import (
	"context"
	"embed"
	"fmt"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// Migrate applies all pending *.up.sql migrations in lexical order inside a
// transaction each, tracking applied versions in the schema_migrations table.
//
// This is a deliberately small, dependency-free migrator. The file naming
// (NNNNNN_name.up.sql / .down.sql) matches the golang-migrate convention so we
// can switch to that tool later without renaming anything.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	applied, err := appliedVersions(ctx, pool)
	if err != nil {
		return err
	}

	versions, err := upMigrations()
	if err != nil {
		return err
	}

	for _, m := range versions {
		if applied[m.version] {
			continue
		}
		sqlBytes, err := migrationFS.ReadFile("migrations/" + m.file)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", m.file, err)
		}
		tx, err := pool.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sqlBytes)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("apply migration %s: %w", m.file, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, m.version); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("record migration %s: %w", m.version, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit migration %s: %w", m.version, err)
		}
		fmt.Printf("[migrate] applied %s\n", m.file)
	}
	return nil
}

type migration struct {
	version string
	file    string
}

func upMigrations() ([]migration, error) {
	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return nil, err
	}
	var out []migration
	for _, e := range entries {
		name := e.Name()
		if !strings.HasSuffix(name, ".up.sql") {
			continue
		}
		version := strings.SplitN(name, "_", 2)[0]
		out = append(out, migration{version: version, file: name})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].file < out[j].file })
	return out, nil
}

func appliedVersions(ctx context.Context, pool *pgxpool.Pool) (map[string]bool, error) {
	rows, err := pool.Query(ctx, `SELECT version FROM schema_migrations`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	applied := map[string]bool{}
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		applied[v] = true
	}
	return applied, rows.Err()
}
