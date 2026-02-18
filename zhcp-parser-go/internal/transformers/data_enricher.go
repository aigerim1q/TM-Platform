package transformers

import (
	"sort"
	"strings"
	"time"
)

// DataEnricher enriches extracted data with additional context
type DataEnricher struct {
	logger interface{} // In a real implementation, we'd use a proper logger interface
}

// NewDataEnricher creates a new data enricher
func NewDataEnricher() *DataEnricher {
	return &DataEnricher{}
}

// EnrichData adds computed fields and derived information
func (de *DataEnricher) EnrichData(transformedData *ProjectStructure) *ProjectStructure {
	enriched := *transformedData

	// Add computed metadata
	if enriched.Project.Metadata == nil {
		enriched.Project.Metadata = make(map[string]interface{})
	}

	enriched.Project.Metadata["extraction_date"] = time.Now().Format("2006-01-02T15:04:05Z07:00")

	// Calculate fields based on the enriched structure (so we work with the copy)
	calculatedFields := de.calculateDerivedFields(&enriched)
	enriched.Project.Metadata["calculated_fields"] = calculatedFields

	// Fix for issue: "Project: Deadline is missing"
	// If the Project.Deadline is empty, we infer it from the latest date found ("project_end").
	if enriched.Project.Deadline == "" {
		if projectEnd, ok := calculatedFields["project_end"].(string); ok {
			enriched.Project.Deadline = projectEnd
		}
	}

	enriched.Project.Metadata["data_quality_score"] = de.calculateDataQuality(transformedData)
	enriched.Project.Metadata["complexity_metrics"] = de.calculateComplexityMetrics(transformedData)

	return &enriched
}

// calculateDerivedFields calculates derived fields from the data
func (de *DataEnricher) calculateDerivedFields(data *ProjectStructure) map[string]interface{} {
	phases := data.Project.Phases

	// Calculate project timeline
	var allDates []string
	for _, phase := range phases {
		if phase.StartDate != "" {
			allDates = append(allDates, phase.StartDate)
		}
		if phase.EndDate != "" {
			allDates = append(allDates, phase.EndDate)
		}

		for _, task := range phase.Tasks {
			if task.StartDate != "" {
				allDates = append(allDates, task.StartDate)
			}
			if task.EndDate != "" {
				allDates = append(allDates, task.EndDate)
			}
		}
	}

	if len(allDates) > 0 {
		sort.Strings(allDates)
		startDate := allDates[0]
		endDate := allDates[len(allDates)-1]

		calculatedFields := make(map[string]interface{})
		calculatedFields["project_start"] = startDate
		calculatedFields["project_end"] = endDate
		calculatedFields["total_duration_days"] = de.calculateDuration(startDate, endDate)

		return calculatedFields
	}

	return make(map[string]interface{})
}

// calculateDuration calculates duration in days between two dates
func (de *DataEnricher) calculateDuration(startDate, endDate string) int {
	start, err1 := time.Parse("2006-01-02", startDate)
	end, err2 := time.Parse("2006-01-02", endDate)

	if err1 != nil || err2 != nil {
		return 0
	}

	return int(end.Sub(start).Hours() / 24)
}

// calculateDataQuality calculates data quality score
func (de *DataEnricher) calculateDataQuality(data *ProjectStructure) float64 {
	totalFields := 0
	filledFields := 0

	// Check top-level fields
	for _, field := range []string{data.Project.Title, data.Project.Description} {
		totalFields++
		if field != "" {
			filledFields++
		}
	}

	// Check phases
	for _, phase := range data.Project.Phases {
		for _, field := range []string{phase.Name, phase.Description} {
			totalFields++
			if field != "" {
				filledFields++
			}
		}

		// Check tasks
		for _, task := range phase.Tasks {
			for _, field := range []string{task.Name, task.Description} {
				totalFields++
				if field != "" {
					filledFields++
				}
			}
		}
	}

	if totalFields == 0 {
		return 0.0
	}

	return float64(filledFields) / float64(totalFields)
}

// calculateComplexityMetrics calculates project complexity metrics
func (de *DataEnricher) calculateComplexityMetrics(data *ProjectStructure) map[string]int {
	phases := data.Project.Phases

	metrics := make(map[string]int)
	metrics["total_phases"] = len(phases)
	metrics["total_tasks"] = 0
	metrics["total_responsibles"] = 0

	for _, phase := range phases {
		metrics["total_tasks"] += len(phase.Tasks)

		for _, task := range phase.Tasks {
			metrics["total_responsibles"] += len(task.ResponsiblePersons)
		}
	}

	return metrics
}

// CalculateProjectHealth calculates overall project health based on various factors
func (de *DataEnricher) CalculateProjectHealth(data *ProjectStructure) map[string]interface{} {
	health := make(map[string]interface{})

	// Calculate data completeness
	qualityScore := de.calculateDataQuality(data)
	health["data_completeness"] = qualityScore

	// Check for date consistency
	dateIssues := 0
	for _, phase := range data.Project.Phases {
		if phase.StartDate != "" && phase.EndDate != "" {
			start, err1 := time.Parse("2006-01-02", phase.StartDate)
			end, err2 := time.Parse("2006-01-02", phase.EndDate)

			if err1 == nil && err2 == nil && start.After(end) {
				dateIssues++
			}
		}

		for _, task := range phase.Tasks {
			if task.StartDate != "" && task.EndDate != "" {
				start, err1 := time.Parse("2006-01-02", task.StartDate)
				end, err2 := time.Parse("2006-01-02", task.EndDate)

				if err1 == nil && err2 == nil && start.After(end) {
					dateIssues++
				}
			}
		}
	}

	health["date_consistency_issues"] = dateIssues

	// Check for task dependencies
	totalDependencies := 0
	for _, phase := range data.Project.Phases {
		for _, task := range phase.Tasks {
			totalDependencies += len(task.Dependencies)
		}
	}

	health["total_dependencies"] = totalDependencies

	// Calculate health score
	healthScore := qualityScore
	if dateIssues > 0 {
		// Reduce health score for each date inconsistency
		healthScore -= float64(dateIssues) * 0.1
		if healthScore < 0 {
			healthScore = 0
		}
	}

	health["overall_health_score"] = healthScore

	return health
}

// ExtractKeyFacts extracts key facts from the project structure
func (de *DataEnricher) ExtractKeyFacts(data *ProjectStructure) map[string]interface{} {
	facts := make(map[string]interface{})

	facts["project_title"] = data.Project.Title
	facts["project_description"] = data.Project.Description
	facts["total_phases"] = len(data.Project.Phases)
	facts["total_tasks"] = 0
	facts["total_responsibles"] = 0
	facts["has_timeline"] = false

	taskCount := 0
	respCount := 0

	for _, phase := range data.Project.Phases {
		taskCount += len(phase.Tasks)
		for _, task := range phase.Tasks {
			respCount += len(task.ResponsiblePersons)
			if task.StartDate != "" || task.EndDate != "" {
				facts["has_timeline"] = true
			}
		}
	}

	facts["total_tasks"] = taskCount
	facts["total_responsibles"] = respCount

	// Extract unique roles
	roles := make(map[string]bool)
	for _, phase := range data.Project.Phases {
		for _, task := range phase.Tasks {
			for _, resp := range task.ResponsiblePersons {
				if strings.TrimSpace(resp.Role) != "" {
					roles[strings.TrimSpace(resp.Role)] = true
				}
			}
		}
	}

	roleList := make([]string, 0, len(roles))
	for role := range roles {
		roleList = append(roleList, role)
	}

	facts["unique_roles"] = roleList

	return facts
}
