package validators

import (
	"fmt"
	"time"

	"zhcp-parser-go/internal/transformers"
)

// ConsistencyValidator validates data consistency and business rules
type ConsistencyValidator struct{}

// NewConsistencyValidator creates a new consistency validator
func NewConsistencyValidator() *ConsistencyValidator {
	return &ConsistencyValidator{}
}

// ValidateConsistency validates data consistency and business rules
func (cv *ConsistencyValidator) ValidateConsistency(structure *transformers.ProjectStructure) *ConsistencyValidationResult {
	results := &ConsistencyValidationResult{
		IsValid:     true,
		Issues:      []string{},
		Warnings:    []string{},
		Suggestions: []string{},
	}

	project := structure.Project
	phases := project.Phases

	// Check for duplicate IDs
	phaseIds := make(map[string]bool)
	taskIds := make(map[string]bool)

	for _, phase := range phases {
		phaseId := phase.ID
		if phaseId != "" {
			if phaseIds[phaseId] {
				results.Issues = append(results.Issues, fmt.Sprintf("Duplicate phase ID: %s", phaseId))
				results.IsValid = false
			} else {
				phaseIds[phaseId] = true
			}
		}

		tasks := phase.Tasks
		for _, task := range tasks {
			taskId := task.ID
			if taskId != "" {
				if taskIds[taskId] {
					results.Issues = append(results.Issues, fmt.Sprintf("Duplicate task ID: %s", taskId))
					results.IsValid = false
				} else {
					taskIds[taskId] = true
				}
			}
		}
	}

	// Validate date relationships
	for _, phase := range phases {
		startDate := phase.StartDate
		endDate := phase.EndDate

		if startDate != "" && endDate != "" {
			start, err1 := time.Parse("2006-01-02", startDate)
			end, err2 := time.Parse("2006-01-02", endDate)

			if err1 == nil && err2 == nil {
				if start.After(end) {
					results.Warnings = append(results.Warnings,
						fmt.Sprintf("Phase '%s': start date (%s) is after end date (%s). Dates may need correction.",
							phase.Name, startDate, endDate))
				}
			} else {
				results.Issues = append(results.Issues,
					fmt.Sprintf("Phase '%s': invalid date format", phase.Name))
				results.IsValid = false
			}
		}

		// Validate task dates within phase context
		tasks := phase.Tasks
		for _, task := range tasks {
			taskStart := task.StartDate
			taskEnd := task.EndDate

			if taskStart != "" && taskEnd != "" {
				taskStartDt, err1 := time.Parse("2006-01-02", taskStart)
				taskEndDt, err2 := time.Parse("2006-01-02", taskEnd)

				if err1 == nil && err2 == nil {
					if taskStartDt.After(taskEndDt) {
						results.Warnings = append(results.Warnings,
							fmt.Sprintf("Task '%s': start date (%s) is after end date (%s). Dates may need correction.",
								task.Name, taskStart, taskEnd))
					}
				}
			}

			if taskStart != "" && startDate != "" {
				taskStartDt, err1 := time.Parse("2006-01-02", taskStart)
				phaseStartDt, err2 := time.Parse("2006-01-02", startDate)

				if err1 == nil && err2 == nil {
					if taskStartDt.Before(phaseStartDt) {
						results.Warnings = append(results.Warnings,
							fmt.Sprintf("Task '%s': starts before phase begins", task.Name))
					}
				}
			}

			if taskEnd != "" && endDate != "" {
				taskEndDt, err1 := time.Parse("2006-01-02", taskEnd)
				phaseEndDt, err2 := time.Parse("2006-01-02", endDate)

				if err1 == nil && err2 == nil {
					if taskEndDt.After(phaseEndDt) {
						results.Warnings = append(results.Warnings,
							fmt.Sprintf("Task '%s': ends after phase ends", task.Name))
					}
				}
			}
		}
	}

	// Validate dependency references
	allTaskIds := make(map[string]bool)
	for _, phase := range phases {
		for _, task := range phase.Tasks {
			allTaskIds[task.ID] = true
		}
	}

	for _, phase := range phases {
		for _, task := range phase.Tasks {
			invalidDeps := []string{}
			for _, dep := range task.Dependencies {
				if !allTaskIds[dep] {
					invalidDeps = append(invalidDeps, dep)
				}
			}

			if len(invalidDeps) > 0 {
				results.Issues = append(results.Issues,
					fmt.Sprintf("Task '%s' has invalid dependencies: %v", task.Name, invalidDeps))
				results.IsValid = false
			}
		}
	}

	return results
}
