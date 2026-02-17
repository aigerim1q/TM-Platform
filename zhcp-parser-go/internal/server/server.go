package server

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"zhcp-parser-go/internal/parser"
	"zhcp-parser-go/internal/storage"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
)

type Server struct {
	parser *parser.ZhcpParser
	store  storage.Storage
	port   string
	jobs   map[string]*ParseJob
	jobsMu sync.RWMutex
}

type ParseJob struct {
	ID        string                `json:"id"`
	Status    string                `json:"status"` // queued, processing, completed, failed
	Progress  int                   `json:"progress"`
	Result    *parser.ParseResult   `json:"result,omitempty"`
	Error     string                `json:"error,omitempty"`
	CreatedAt time.Time             `json:"created_at"`
	UpdatedAt time.Time             `json:"updated_at"`
}

type UploadResponse struct {
	JobID  string `json:"jobId"`
	Status string `json:"status"`
}

type StatusResponse struct {
	JobID    string `json:"jobId"`
	Status   string `json:"status"`
	Progress int    `json:"progress"`
	Error    string `json:"error,omitempty"`
}

func NewServer(parser *parser.ZhcpParser, store storage.Storage, port string) *Server {
	return &Server{
		parser: parser,
		store:  store,
		port:   port,
		jobs:   make(map[string]*ParseJob),
	}
}

func (s *Server) Start() error {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS configuration for frontend
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:3001", "http://localhost:3002"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Routes
	r.Route("/api", func(r chi.Router) {
		// Parse endpoints
		r.Post("/parse/upload", s.handleUpload)
		r.Get("/parse/status/{jobId}", s.handleStatus)
		r.Get("/parse/result/{jobId}", s.handleResult)

		// Project endpoints
		r.Get("/projects", s.handleListProjects)
		r.Get("/projects/{id}", s.handleGetProject)
		r.Post("/projects", s.handleCreateProject)
		r.Put("/projects/{id}", s.handleUpdateProject)
		r.Delete("/projects/{id}", s.handleDeleteProject)

		// Task endpoints
		r.Get("/projects/{projectId}/tasks", s.handleListTasks)
		r.Get("/tasks/{id}", s.handleGetTask)
		r.Put("/tasks/{id}", s.handleUpdateTask)
		r.Put("/tasks/{id}/status", s.handleUpdateTaskStatus)
	})

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	addr := ":" + s.port
	log.Printf("🚀 Server listening on %s\n", addr)
	return http.ListenAndServe(addr, r)
}

// ============================================================================
// Parse Handlers
// ============================================================================

func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form
	if err := r.ParseMultipartForm(32 << 20); err != nil { // 32 MB max
		writeError(w, http.StatusBadRequest, "Failed to parse form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "No file provided")
		return
	}
	defer file.Close()

	// Validate file type
	ext := filepath.Ext(header.Filename)
	if ext != ".pdf" && ext != ".docx" {
		writeError(w, http.StatusBadRequest, "Only PDF and DOCX files are supported")
		return
	}

	// Create temp file
	tempDir := os.TempDir()
	tempFile := filepath.Join(tempDir, fmt.Sprintf("%s%s", uuid.New().String(), ext))
	
	out, err := os.Create(tempFile)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create temp file")
		return
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to save file")
		return
	}

	// Create job
	jobID := uuid.New().String()
	job := &ParseJob{
		ID:        jobID,
		Status:    "queued",
		Progress:  0,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	s.jobsMu.Lock()
	s.jobs[jobID] = job
	s.jobsMu.Unlock()

	// Process asynchronously
	go s.processFile(jobID, tempFile)

	writeJSON(w, http.StatusAccepted, UploadResponse{
		JobID:  jobID,
		Status: "queued",
	})
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "jobId")

	s.jobsMu.RLock()
	job, exists := s.jobs[jobID]
	s.jobsMu.RUnlock()

	if !exists {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}

	writeJSON(w, http.StatusOK, StatusResponse{
		JobID:    job.ID,
		Status:   job.Status,
		Progress: job.Progress,
		Error:    job.Error,
	})
}

func (s *Server) handleResult(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "jobId")

	s.jobsMu.RLock()
	job, exists := s.jobs[jobID]
	s.jobsMu.RUnlock()

	if !exists {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}

	if job.Status != "completed" {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Job not completed, current status: %s", job.Status))
		return
	}

	writeJSON(w, http.StatusOK, job.Result)
}

func (s *Server) processFile(jobID, filePath string) {
	defer os.Remove(filePath) // Clean up temp file

	s.jobsMu.Lock()
	job := s.jobs[jobID]
	job.Status = "processing"
	job.Progress = 10
	job.UpdatedAt = time.Now()
	s.jobsMu.Unlock()

	// Parse document
	result, err := s.parser.ParseDocument(filePath, true, true)
	
	s.jobsMu.Lock()
	defer s.jobsMu.Unlock()

	if err != nil {
		job.Status = "failed"
		job.Error = err.Error()
		job.Progress = 0
		job.UpdatedAt = time.Now()
		return
	}

	job.Status = "completed"
	job.Progress = 100
	job.Result = result
	job.UpdatedAt = time.Now()

	// Persisting parsed structure to storage is not wired yet; skip for now.
}

// ============================================================================
// Project Handlers
// ============================================================================

func (s *Server) handleListProjects(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		writeError(w, http.StatusServiceUnavailable, "Storage not configured")
		return
	}

	projects, err := s.store.ListProjects(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list projects")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"items": projects,
		"total": len(projects),
	})
}

func (s *Server) handleGetProject(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		writeError(w, http.StatusServiceUnavailable, "Storage not configured")
		return
	}

	id := chi.URLParam(r, "id")
	project, err := s.store.GetProject(r.Context(), id)
	if err != nil {
		if err == storage.ErrNotFound {
			writeError(w, http.StatusNotFound, "Project not found")
		} else {
			writeError(w, http.StatusInternalServerError, "Failed to get project")
		}
		return
	}

	writeJSON(w, http.StatusOK, project)
}

func (s *Server) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		writeError(w, http.StatusServiceUnavailable, "Storage not configured")
		return
	}

	var project storage.Project
	if err := json.NewDecoder(r.Body).Decode(&project); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := s.store.SaveProject(r.Context(), &project); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create project")
		return
	}

	writeJSON(w, http.StatusCreated, project)
}

func (s *Server) handleUpdateProject(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		writeError(w, http.StatusServiceUnavailable, "Storage not configured")
		return
	}

	id := chi.URLParam(r, "id")
	var project storage.Project
	if err := json.NewDecoder(r.Body).Decode(&project); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	project.ID = id
	if err := s.store.UpdateProject(r.Context(), &project); err != nil {
		if err == storage.ErrNotFound {
			writeError(w, http.StatusNotFound, "Project not found")
		} else {
			writeError(w, http.StatusInternalServerError, "Failed to update project")
		}
		return
	}

	writeJSON(w, http.StatusOK, project)
}

func (s *Server) handleDeleteProject(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		writeError(w, http.StatusServiceUnavailable, "Storage not configured")
		return
	}

	id := chi.URLParam(r, "id")
	if err := s.store.DeleteProject(r.Context(), id); err != nil {
		if err == storage.ErrNotFound {
			writeError(w, http.StatusNotFound, "Project not found")
		} else {
			writeError(w, http.StatusInternalServerError, "Failed to delete project")
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Project deleted"})
}

// ============================================================================
// Task Handlers
// ============================================================================

func (s *Server) handleListTasks(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		writeError(w, http.StatusServiceUnavailable, "Storage not configured")
		return
	}

	projectID := chi.URLParam(r, "projectId")
	tasks, err := s.store.ListTasks(r.Context(), projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list tasks")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"items": tasks,
		"total": len(tasks),
	})
}

func (s *Server) handleGetTask(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		writeError(w, http.StatusServiceUnavailable, "Storage not configured")
		return
	}

	id := chi.URLParam(r, "id")
	task, err := s.store.GetTask(r.Context(), id)
	if err != nil {
		if err == storage.ErrNotFound {
			writeError(w, http.StatusNotFound, "Task not found")
		} else {
			writeError(w, http.StatusInternalServerError, "Failed to get task")
		}
		return
	}

	writeJSON(w, http.StatusOK, task)
}

func (s *Server) handleUpdateTask(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		writeError(w, http.StatusServiceUnavailable, "Storage not configured")
		return
	}

	id := chi.URLParam(r, "id")
	var task storage.Task
	if err := json.NewDecoder(r.Body).Decode(&task); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	task.ID = id
	if err := s.store.UpdateTask(r.Context(), &task); err != nil {
		if err == storage.ErrNotFound {
			writeError(w, http.StatusNotFound, "Task not found")
		} else {
			writeError(w, http.StatusInternalServerError, "Failed to update task")
		}
		return
	}

	writeJSON(w, http.StatusOK, task)
}

func (s *Server) handleUpdateTaskStatus(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		writeError(w, http.StatusServiceUnavailable, "Storage not configured")
		return
	}

	id := chi.URLParam(r, "id")
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := s.store.UpdateTaskStatus(r.Context(), id, body.Status); err != nil {
		if err == storage.ErrNotFound {
			writeError(w, http.StatusNotFound, "Task not found")
		} else {
			writeError(w, http.StatusInternalServerError, "Failed to update task status")
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": body.Status})
}

// ============================================================================
// Helper Functions
// ============================================================================

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
