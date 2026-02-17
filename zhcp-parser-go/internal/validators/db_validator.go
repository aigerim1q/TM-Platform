package validators

import (
	"fmt"
	"strings"

	"zhcp-parser-go/internal/transformers"
)

// DBValidator checks if the project structure meets the requirements for database storage
type DBValidator struct{}

// NewDBValidator creates a new DB validator
func NewDBValidator() *DBValidator {
	return &DBValidator{}
}

// ValidateForDB checks if key fields required for DB persistence are present.
// It returns a list of missing field descriptions. If the list is empty, validation passed.
func (v *DBValidator) ValidateForDB(p *transformers.ProjectStructure) []string {
	var missing []string

	if p == nil {
		return []string{"Project structure is nil"}
	}

	// Project-level checks
	if strings.TrimSpace(p.Project.Title) == "" {
		missing = append(missing, "Project: Title is missing")
	}
	if strings.TrimSpace(p.Project.Deadline) == "" {
		// Attempt to use EndDate of the last phase if Project Deadline is missing?
		// Requirement says: "Дедлайн на весь проект"
		missing = append(missing, "Project: Deadline is missing")
	}
	if len(p.Project.Phases) == 0 {
		missing = append(missing, "Project: No phases found (count is 0)")
	}

	// Phase and Task checks
	for i, phase := range p.Project.Phases {
		phaseIndex := i + 1
		// Check tasks
		if len(phase.Tasks) == 0 {
			missing = append(missing, fmt.Sprintf("Phase %d (%s): No tasks found", phaseIndex, phase.Name))
		}

		for j, task := range phase.Tasks {
			taskIndex := j + 1
			taskLoc := fmt.Sprintf("Phase %dTask %d", phaseIndex, taskIndex)

			if strings.TrimSpace(task.Name) == "" {
				missing = append(missing, fmt.Sprintf("%s: Name is missing", taskLoc))
			}

			// Deadline for each task (EndDate)
			if strings.TrimSpace(task.EndDate) == "" {
				missing = append(missing, fmt.Sprintf("%s (%s): Deadline (end_date) is missing", taskLoc, task.Name))
			}

			// Responsible persons
			if len(task.ResponsiblePersons) == 0 {
				missing = append(missing, fmt.Sprintf("%s (%s): Responsible persons list is empty", taskLoc, task.Name))
			}
		}
	}

	return missing
}
