package test

import (
	"context"
	"path/filepath"
	"testing"

	"zhcp-parser-go/internal/storage/sqlite"
	"zhcp-parser-go/internal/transformers"
	"zhcp-parser-go/internal/validators"
)

func TestFullDBFlow(t *testing.T) {
	// 1. Setup Validation Logic
	// We want to test that the requirements are met:
	// - Project Name
	// - Project Deadline
	// - Count of Phases
	// - Task Name
	// - Task Responsibles (Array)
	// - Task Deadline

	// Create a VALID Project Structure
	validProject := &transformers.ProjectStructure{
		Project: transformers.Project{
			Title:       "Valid Test Project",
			Description: "A project that has all required fields",
			Deadline:    "2026-12-31",
			Phases: []transformers.Phase{
				{
					ID:          "P1",
					Name:        "Phase 1",
					Description: "First Phase",
					StartDate:   "2026-01-01",
					EndDate:     "2026-06-30",
					Tasks: []transformers.Task{
						{
							ID:          "T1",
							Name:        "Task 1",
							Description: "A task with checks",
							StartDate:   "2026-01-01",
							EndDate:     "2026-01-31", // Task Deadline
							Status:      "planned",
							ResponsiblePersons: []transformers.ResponsiblePerson{
								{Name: "John Doe", Role: "Manager"}, // Responsible
							},
						},
					},
				},
			},
		},
	}

	// 2. Run Validator
	val := validators.NewDBValidator()
	missing := val.ValidateForDB(validProject)
	if len(missing) > 0 {
		t.Fatalf("Validation failed for valid project: %v", missing)
	}

	// 3. Create Temp DB
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test_zhcp.db")

	store := sqlite.New(dbPath)
	if err := store.Init(context.Background()); err != nil {
		t.Fatalf("Failed to init store: %v", err)
	}
	defer store.Close()

	// 4. Persist Project
	res, err := store.PersistProjectStructure(context.Background(), validProject)
	if err != nil {
		t.Fatalf("Failed to persist project: %v", err)
	}

	if res.ProjectID == 0 {
		t.Error("Returned ProjectID is 0")
	}
	if len(res.PhaseIDs) != 1 {
		t.Errorf("Expected 1 PhaseID, got %d", len(res.PhaseIDs))
	}
	if len(res.TaskIDs) != 1 {
		t.Errorf("Expected 1 TaskID, got %d", len(res.TaskIDs))
	}

	t.Logf("Successfully saved project ID %d to %s", res.ProjectID, dbPath)

	// 5. Test INVALID Project (Missing Task Deadline and Responsible)
	invalidProject := &transformers.ProjectStructure{
		Project: transformers.Project{
			Title:    "Invalid Project",
			Deadline: "2026-12-31",
			Phases: []transformers.Phase{
				{
					Name: "Phase 1",
					Tasks: []transformers.Task{
						{
							Name: "Task Without Deadline/Resp",
							// Missing EndDate
							// Missing ResponsiblePersons
						},
					},
				},
			},
		},
	}

	missing = val.ValidateForDB(invalidProject)
	if len(missing) == 0 {
		t.Error("Validation should have failed for invalid project, but got 0 missing fields")
	} else {
		t.Logf("Correctly identified %d missing fields", len(missing))
		for _, m := range missing {
			t.Logf(" - %s", m)
		}
	}
}
