package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"tm-platform-backend/internal/aichat"
	"tm-platform-backend/internal/auth"
	"tm-platform-backend/internal/chats"
	"tm-platform-backend/internal/config"
	"tm-platform-backend/internal/db"
	"tm-platform-backend/internal/handlers"
	"tm-platform-backend/internal/hierarchy"
	"tm-platform-backend/internal/httpapi"
	"tm-platform-backend/internal/notifications"
	"tm-platform-backend/internal/projectfiles"
	"tm-platform-backend/internal/projects"
	"tm-platform-backend/internal/zhcp"
)

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("invalid configuration: %v", err)
	}

	dbConn, err := db.Open(cfg.DatabaseDSN())
	if err != nil {
		log.Fatalf("db connection failed: %v", err)
	}
	defer dbConn.Close()

	authRepo := auth.NewRepository(dbConn)
	authSvc := auth.NewService(cfg.JWTSecret)
	authHandler := auth.NewHandler(authRepo, authSvc, cfg.AppEnv)
	hierarchyRepo := hierarchy.NewRepository(dbConn)
	hierarchyHandler := hierarchy.NewHandler(hierarchyRepo, authRepo)
	notificationsRepo := notifications.NewRepository(dbConn)

	projectsRepo := projects.NewRepository(dbConn)
	projectsHandler := projects.NewHTTPHandler(projectsRepo, notificationsRepo)

	uploadHandler, err := handlers.NewUploadHandler("uploads")
	if err != nil {
		log.Fatalf("upload handler init failed: %v", err)
	}

	projectFilesRepo := projectfiles.NewRepository(dbConn)
	projectFilesHandler := projectfiles.NewHandler(projectFilesRepo)
	zhcpClient := zhcp.NewClient(cfg.ZHCPParserURL)
	zhcpHandler := zhcp.NewHandler(zhcpClient, projectsRepo)
	aiChatRepo := aichat.NewRepository(dbConn)
	aiChatHandler := aichat.NewHandler(aiChatRepo)
	notificationsHandler := notifications.NewHandler(notificationsRepo)
	chatsRepo := chats.NewRepository(dbConn)
	chatsHandler := chats.NewHandler(chatsRepo, notificationsRepo)

	readyCheck := func() error {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		return dbConn.PingContext(ctx)
	}
	router := httpapi.NewRouter(
		authHandler,
		hierarchyHandler,
		projectsHandler,
		uploadHandler,
		projectFilesHandler,
		zhcpHandler,
		aiChatHandler,
		notificationsHandler,
		chatsHandler,
		authSvc,
		cfg.CORSOrigins,
		readyCheck,
	)
	mux := http.NewServeMux()
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))
	mux.Handle("/", router)

	server := &http.Server{
		Addr:              cfg.ServerAddr,
		Handler:           mux,
		ReadTimeout:       cfg.ReadTimeout,
		ReadHeaderTimeout: cfg.ReadHdrTO,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Printf("server started on %s", cfg.ServerAddr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-sigCh:
		log.Printf("shutdown signal received: %s", sig.String())
	case err := <-errCh:
		log.Fatalf("server failed: %v", err)
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownGrace)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("graceful shutdown failed: %v", err)
	}
	log.Printf("server stopped")
}
