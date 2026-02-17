package main

import (
	"log"
	"net/http"

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

	dbConn, err := db.Open(cfg.DatabaseDSN())
	if err != nil {
		log.Fatalf("db connection failed: %v", err)
	}
	defer dbConn.Close()

	authRepo := auth.NewRepository(dbConn)
	authSvc := auth.NewService(cfg.JWTSecret)
	authHandler := auth.NewHandler(authRepo, authSvc)
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

	router := httpapi.NewRouter(authHandler, hierarchyHandler, projectsHandler, uploadHandler, projectFilesHandler, zhcpHandler, aiChatHandler, notificationsHandler, chatsHandler, authSvc)
	mux := http.NewServeMux()
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))
	mux.Handle("/", router)

	server := &http.Server{
		Addr:    cfg.ServerAddr,
		Handler: mux,
	}

	log.Printf("server started on %s", cfg.ServerAddr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server failed: %v", err)
	}
}
