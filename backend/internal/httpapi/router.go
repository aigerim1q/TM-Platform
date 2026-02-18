package httpapi

import (
	"net/http"

	"tm-platform-backend/internal/aichat"
	"tm-platform-backend/internal/auth"
	"tm-platform-backend/internal/chats"
	"tm-platform-backend/internal/handlers"
	"tm-platform-backend/internal/hierarchy"
	"tm-platform-backend/internal/notifications"
	"tm-platform-backend/internal/projectfiles"
	"tm-platform-backend/internal/projects"
	"tm-platform-backend/internal/zhcp"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func NewRouter(authHandler *auth.Handler, hierarchyHandler *hierarchy.Handler, projectsHandler *projects.HTTPHandler, uploadHandler *handlers.UploadHandler, projectFilesHandler *projectfiles.Handler, zhcpHandler *zhcp.Handler, aiChatHandler *aichat.Handler, notificationsHandler *notifications.Handler, chatsHandler *chats.Handler, authSvc *auth.Service) http.Handler {
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
		r.Get("/notifications", notificationsHandler.List)
		r.Get("/notifications/unread-count", notificationsHandler.UnreadCount)
		r.Post("/notifications/read-all", notificationsHandler.MarkAllRead)
		r.Post("/notifications/{id}/read", notificationsHandler.MarkRead)
		r.Get("/ai-chat/messages", aiChatHandler.ListMessages)
		r.Post("/ai-chat/messages", aiChatHandler.AppendMessage)
		r.Post("/chats/presence", chatsHandler.TouchPresence)
		r.Get("/chats/unread-count", chatsHandler.UnreadCount)
		r.Get("/chats/users", chatsHandler.ListUsers)
		r.Get("/chats/threads", chatsHandler.ListThreads)
		r.Post("/chats/threads/direct", chatsHandler.EnsureDirectThread)
		r.Post("/chats/threads/group", chatsHandler.CreateGroupThread)
		r.Patch("/chats/threads/{threadId}", chatsHandler.RenameThread)
		r.Post("/chats/threads/{threadId}/call-invite", chatsHandler.InviteToCall)
		r.Get("/chats/threads/{threadId}/messages", chatsHandler.ListMessages)
		r.Post("/chats/threads/{threadId}/messages", chatsHandler.AppendMessage)
		r.Post("/zhcp/import", zhcpHandler.Import)
		r.Post("/zhcp/parse-context", zhcpHandler.ParseContext)
		r.Post("/zhcp/create-project-from-context", zhcpHandler.CreateProjectFromContext)
		r.Post("/zhcp/create-task-from-context", zhcpHandler.CreateTaskFromContext)
		r.Get("/users", authHandler.ListUsers)
		r.Post("/departments", authHandler.CreateDepartment)
		r.Get("/departments", authHandler.ListDepartments)
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
		r.Patch("/users/{id}/profile", authHandler.UpdateUserProfile)
		r.Put("/users/{id}/hierarchy", authHandler.UpdateUserHierarchy)
		r.Get("/users/{id}/manager", authHandler.GetUserManager)
		r.Get("/users/{id}/subordinates", authHandler.GetUserSubordinates)
		r.Get("/hierarchy", authHandler.GetHierarchy)
		r.Get("/hierarchy/tree", hierarchyHandler.GetTree)
		r.Patch("/hierarchy/assign-user", hierarchyHandler.AssignUser)
		r.Post("/hierarchy/nodes", hierarchyHandler.CreateNode)
		r.Patch("/hierarchy/nodes/{id}", hierarchyHandler.UpdateNode)
		r.Delete("/hierarchy/nodes/{id}", hierarchyHandler.DeleteNode)
		r.Patch("/hierarchy/nodes/{id}/status", hierarchyHandler.UpdateStatus)
	})

	return r
}
