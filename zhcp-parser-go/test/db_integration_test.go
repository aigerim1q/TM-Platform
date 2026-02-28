package test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"zhcp-parser-go/internal/storage"
	"zhcp-parser-go/internal/storage/sqlite"
)

func TestProjectAndTaskPersistence(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test_zhcp.db")

	store := sqlite.New(dbPath)
	if err := store.Init(context.Background()); err != nil {
		t.Fatalf("Failed to init store: %v", err)
	}
	defer store.Close()

	project := &storage.Project{
		Title:       "Valid Test Project",
		Description: "A project that has all required fields",
		Status:      "planned",
		Metadata: map[string]interface{}{
			"source": "test",
		},
	}
	if err := store.SaveProject(context.Background(), project); err != nil {
		t.Fatalf("Failed to save project: %v", err)
	}
	if project.ID == "" {
		t.Fatal("project id should be generated")
	}

	task := &storage.Task{
		ProjectID:  project.ID,
		Title:      "Task 1",
		Status:     "pending",
		Priority:   "high",
		AssignedTo: "John Doe",
		DueDate:    ptrTime(time.Now().Add(24 * time.Hour)),
	}
	if err := store.SaveTask(context.Background(), task); err != nil {
		t.Fatalf("Failed to save task: %v", err)
	}
	if task.ID == "" {
		t.Fatal("task id should be generated")
	}

	loadedProject, err := store.GetProject(context.Background(), project.ID)
	if err != nil {
		t.Fatalf("Failed to load project: %v", err)
	}
	if loadedProject.Title != project.Title {
		t.Fatalf("project title mismatch: got %q want %q", loadedProject.Title, project.Title)
	}

	tasks, err := store.ListTasks(context.Background(), project.ID)
	if err != nil {
		t.Fatalf("Failed to list tasks: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(tasks))
	}
	if tasks[0].Title != task.Title {
		t.Fatalf("task title mismatch: got %q want %q", tasks[0].Title, task.Title)
	}

	if err := store.UpdateTaskStatus(context.Background(), task.ID, "completed"); err != nil {
		t.Fatalf("Failed to update task status: %v", err)
	}

	updatedTask, err := store.GetTask(context.Background(), task.ID)
	if err != nil {
		t.Fatalf("Failed to load updated task: %v", err)
	}
	if updatedTask.Status != "completed" {
		t.Fatalf("expected task status completed, got %q", updatedTask.Status)
	}
}

func ptrTime(value time.Time) *time.Time {
	return &value
}
