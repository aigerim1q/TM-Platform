package main

import (
	"log"
	"net/http"

	"tm-platform-backend/internal/auth"
	"tm-platform-backend/internal/config"
	"tm-platform-backend/internal/db"
	"tm-platform-backend/internal/handlers"
	"tm-platform-backend/internal/httpapi"
	"tm-platform-backend/internal/projectfiles"
	"tm-platform-backend/internal/projects"
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

	projectsRepo := projects.NewRepository(dbConn)
	projectsHandler := projects.NewHTTPHandler(projectsRepo)

	uploadHandler, err := handlers.NewUploadHandler("uploads")
	if err != nil {
		log.Fatalf("upload handler init failed: %v", err)
	}

	projectFilesRepo := projectfiles.NewRepository(dbConn)
	projectFilesHandler := projectfiles.NewHandler(projectFilesRepo)

	router := httpapi.NewRouter(authHandler, projectsHandler, uploadHandler, projectFilesHandler, authSvc)
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
