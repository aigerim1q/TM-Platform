package httpapi

import (
	"net/http"

	"tm-platform-backend/internal/auth"
	"tm-platform-backend/internal/handlers"
	"tm-platform-backend/internal/projectfiles"
	"tm-platform-backend/internal/projects"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func NewRouter(authHandler *auth.Handler, projectsHandler *projects.HTTPHandler, uploadHandler *handlers.UploadHandler, projectFilesHandler *projectfiles.Handler, authSvc *auth.Service) http.Handler {
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

	r.Post("/upload", uploadHandler.Upload)

	r.Route("/auth", func(r chi.Router) {
		r.Post("/register", authHandler.Register)
		r.Post("/login", authHandler.Login)
		r.Post("/refresh", authHandler.Refresh)
	})

	r.Group(func(r chi.Router) {
		r.Use(auth.JwtMiddleware(authSvc))
		r.Get("/users", authHandler.ListUsers)
		r.Route("/projects", func(r chi.Router) {
			r.Get("/", projectsHandler.ListProjects)
			r.Post("/", projectsHandler.CreateProject)
			r.Get("/{id}", projectsHandler.GetProject)
			r.With(projectsHandler.RequireEditAccess("id")).Patch("/{id}", projectsHandler.UpdateProject)
			r.Delete("/{id}", projectsHandler.DeleteProject)
			r.Post("/{id}/delay-report", projectsHandler.CreateDelayReport)
			r.Get("/{id}/delay-report", projectsHandler.ListDelayReports)
			r.Post("/{id}/pages", projectsHandler.CreatePage)
			r.Get("/{id}/pages", projectsHandler.ListPages)
			r.Get("/{id}/pages/{pageId}", projectsHandler.GetPage)
			r.Patch("/{id}/pages/{pageId}", projectsHandler.UpdatePage)
			r.Post("/{id}/expenses", projectsHandler.CreateExpense)
			r.Get("/{id}/expenses", projectsHandler.ListExpenses)
			r.Get("/{id}/members", projectsHandler.ListMembers)
			r.Patch("/{id}/roles", projectsHandler.UpdateRoles)
			r.Post("/{id}/members", projectsHandler.UpsertMember)
			r.Delete("/{id}/members/{userId}", projectsHandler.DeleteMember)
			r.With(projectsHandler.RequireEditAccess("id")).Post("/{id}/stages", projectsHandler.CreateStage)
			r.With(projectsHandler.RequireEditAccess("id")).Delete("/{id}/stages/{stageId}", projectsHandler.DeleteStageInProject)
			r.Get("/{id}/stages", projectsHandler.ListStages)
		})
		r.Delete("/expenses/{id}", projectsHandler.DeleteExpense)
		r.Patch("/stages/{id}", projectsHandler.UpdateStage)
		r.Delete("/stages/{id}", projectsHandler.DeleteStage)
		r.Post("/stages/{id}/tasks", projectsHandler.CreateTask)
		r.Get("/stages/{id}/tasks", projectsHandler.ListTasks)
		r.Get("/tasks/{id}", projectsHandler.GetTask)
		r.Get("/tasks/{id}/comments", projectsHandler.ListTaskComments)
		r.Get("/tasks/{id}/history", projectsHandler.ListTaskHistory)
		r.Post("/tasks/{id}/comment", projectsHandler.CreateTaskComment)
		r.Patch("/tasks/{id}", projectsHandler.UpdateTask)
		r.Delete("/tasks/{id}", projectsHandler.DeleteTask)
		r.Post("/project-files", projectFilesHandler.Create)
		r.Get("/documents", projectFilesHandler.ListDocuments)
		r.Get("/users/{id}", authHandler.GetUserProfile)
		r.Get("/users/{id}/manager", authHandler.GetUserManager)
		r.Get("/users/{id}/subordinates", authHandler.GetUserSubordinates)
		r.Get("/hierarchy", authHandler.GetHierarchy)
	})

	return r
}
