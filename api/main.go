package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/stlevy53/personal-crm/api/internal/api"
	"github.com/stlevy53/personal-crm/api/internal/auth"
	"github.com/stlevy53/personal-crm/api/internal/config"
	"github.com/stlevy53/personal-crm/api/internal/db"
	"github.com/stlevy53/personal-crm/api/internal/seed"
)

func main() {
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if cfg.SeedData {
		if err := seed.Run(ctx, pool); err != nil {
			log.Fatalf("seed: %v", err)
		}
	}

	mw, err := auth.New(cfg.AcmeJWKSURL, cfg.AcmeIssuer, cfg.AcmeAudience)
	if err != nil {
		log.Fatalf("auth: %v", err)
	}
	if mw.Enabled() {
		log.Printf("Acme Auth JWT validation ENABLED (issuer=%q)", cfg.AcmeIssuer)
	} else {
		log.Printf("Acme Auth DISABLED (dev bypass) — set ACME_AUTH_JWKS_URL to enable")
	}

	srv := api.NewServer(pool, mw, cfg.CORSOrigins)
	httpSrv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("API listening on :%s", cfg.Port)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http server: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
	_ = os.Stdout.Sync()
}
