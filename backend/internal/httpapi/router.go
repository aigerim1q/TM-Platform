package httpapi

import (
	"net/http"

	"tm-platform-backend/internal/auth"
	"tm-platform-backend/internal/projects"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func NewRouter(authHandler *auth.Handler, projectsHandler *projects.Handler, authSvc *auth.Service) http.Handler {
	r := chi.NewRouter()

	r.Use(CORSMiddleware("http://localhost:3000"))
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Route("/auth", func(r chi.Router) {
		r.Post("/register", authHandler.Register)
		r.Post("/login", authHandler.Login)
		r.Post("/refresh", authHandler.Refresh)
	})

	r.Group(func(r chi.Router) {
		r.Use(auth.JwtMiddleware(authSvc))
		r.Get("/projects", projectsHandler.List)
		r.Post("/projects", projectsHandler.Create)
		r.Get("/users/{id}", authHandler.GetUserProfile)
		r.Get("/users/{id}/manager", authHandler.GetUserManager)
		r.Get("/users/{id}/subordinates", authHandler.GetUserSubordinates)
		r.Get("/hierarchy", authHandler.GetHierarchy)
	})

	return r
}
