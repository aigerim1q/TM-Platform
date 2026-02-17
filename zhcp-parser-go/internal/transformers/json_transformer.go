package transformers

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// DataTransformer handles transformation of LLM responses to standardized project structure
type DataTransformer struct {
	logger       interface{} // In a real implementation, we'd use a proper logger interface
	datePatterns []string
}

// NewDataTransformer creates a new data transformer
func NewDataTransformer() *DataTransformer {
	return &DataTransformer{
		datePatterns: []string{
			`\d{2}\.\d{2}\.\d{4}`, // DD.MM.YYYY
			`\d{4}-\d{2}-\d{2}`,   // YYYY-MM-DD
			`\d{2}/\d{2}/\d{4}`,   // MM/DD/YYYY
		},
	}
}

// Transform transforms LLM response to standardized project structure
func (dt *DataTransformer) Transform(llmResponse string) *TransformationResult {
	result := &TransformationResult{
		ValidationErrors: []string{},
		ProcessingNotes:  []string{},
	}

	// Parse response
	var responseMap map[string]interface{}
	if err := json.Unmarshal([]byte(llmResponse), &responseMap); err != nil {
		result.Status = TransformationStatusFailed
		result.ValidationErrors = append(result.ValidationErrors, fmt.Sprintf("Invalid JSON: %v", err))
		return result
	}

	// Extract project structure
	projectData := responseMap

	// Handle standard "project" wrapper
	if proj, exists := responseMap["project"]; exists {
		if projMap, ok := proj.(map[string]interface{}); ok {
			projectData = projMap
		}
	} else if props, ok := responseMap["properties"].(map[string]interface{}); ok {
		// Handle DeepSeek/Schema-like wrapper: properties -> project -> properties
		if proj, ok := props["project"].(map[string]interface{}); ok {
			if innerProps, ok := proj["properties"].(map[string]interface{}); ok {
				projectData = innerProps
			}
		}
	}

	// Normalize and validate data
	normalizedData := dt.normalizeData(projectData)

	// Validate against schema
	validationResult := dt.validateData(normalizedData)

	if validationResult.IsValid {
		result.TransformedData = normalizedData
		result.Status = TransformationStatusSuccess
		result.ConfidenceScore = dt.calculateConfidenceScore(normalizedData, validationResult)
	} else {
		// Attempt partial transformation
		partialData := dt.createPartialTransformation(normalizedData, validationResult)
		if partialData != nil {
			result.TransformedData = partialData
			result.Status = TransformationStatusPartial
			result.ConfidenceScore = dt.calculateConfidenceScore(partialData, validationResult)
		} else {
			result.Status = TransformationStatusValidationError
			result.ValidationErrors = validationResult.Issues
		}
	}

	result.ProcessingNotes = validationResult.Suggestions
	return result
}

// normalizeData normalizes raw data to standard format
func (dt *DataTransformer) normalizeData(rawData map[string]interface{}) *ProjectStructure {
	projectStructure := &ProjectStructure{
		Project: Project{
			Title:       dt.normalizeText(rawData["title"]),
			Description: dt.normalizeText(rawData["description"]),
			Deadline:    dt.normalizeDate(rawData["deadline"]),
			Phases:      []Phase{},
			Metadata:    make(map[string]interface{}),
		},
		Metadata: Metadata{
			ExtractionDate: time.Now().Format("2006-01-02"),
		},
	}

	// Normalize phases
	if rawPhases, exists := rawData["phases"]; exists {
		if phasesSlice, ok := rawPhases.([]interface{}); ok {
			projectStructure.Project.Phases = dt.normalizePhases(phasesSlice)
		}
	}

	// Add metadata
	if metadata, exists := rawData["metadata"]; exists {
		if metaMap, ok := metadata.(map[string]interface{}); ok {
			projectStructure.Project.Metadata = metaMap
		}
	}

	return projectStructure
}

// normalizePhases normalizes phases data
func (dt *DataTransformer) normalizePhases(rawPhases []interface{}) []Phase {
	phases := make([]Phase, 0, len(rawPhases))

	for i, rawPhase := range rawPhases {
		if rawPhaseMap, ok := rawPhase.(map[string]interface{}); ok {
			phase := Phase{
				ID:          dt.normalizeText(rawPhaseMap["id"]),
				Name:        dt.normalizeText(rawPhaseMap["name"]),
				Description: dt.normalizeText(rawPhaseMap["description"]),
				StartDate:   dt.normalizeDate(rawPhaseMap["start_date"]),
				EndDate:     dt.normalizeDate(rawPhaseMap["end_date"]),
				Tasks:       []Task{},
			}

			// Generate ID if not present
			if phase.ID == "" {
				phase.ID = fmt.Sprintf("phase_%d", i+1)
			}

			// Normalize tasks
			if rawTasks, exists := rawPhaseMap["tasks"]; exists {
				if tasksSlice, ok := rawTasks.([]interface{}); ok {
					phase.Tasks = dt.normalizeTasks(tasksSlice, phase.ID)
				}
			}

			phases = append(phases, phase)
		}
	}

	return phases
}

// normalizeTasks normalizes tasks data
func (dt *DataTransformer) normalizeTasks(rawTasks []interface{}, phaseID string) []Task {
	tasks := make([]Task, 0, len(rawTasks))

	for i, rawTask := range rawTasks {
		if rawTaskMap, ok := rawTask.(map[string]interface{}); ok {
			taskID := dt.normalizeText(rawTaskMap["id"])
			if taskID == "" {
				taskID = fmt.Sprintf("%s_task_%d", phaseID, i+1)
			}

			task := Task{
				ID:          taskID,
				Name:        dt.normalizeText(rawTaskMap["name"]),
				Description: dt.normalizeText(rawTaskMap["description"]),
				StartDate:   dt.normalizeDate(rawTaskMap["start_date"]),
				EndDate:     dt.normalizeDate(rawTaskMap["end_date"]),
				Status:      dt.normalizeStatus(rawTaskMap["status"]),
			}

			// Normalize responsible persons
			if rawResponsibles, exists := rawTaskMap["responsible_persons"]; exists {
				if responsiblesSlice, ok := rawResponsibles.([]interface{}); ok {
					task.ResponsiblePersons = dt.normalizeResponsibles(responsiblesSlice)
				}
			}

			// Normalize dependencies
			if rawDependencies, exists := rawTaskMap["dependencies"]; exists {
				if depsSlice, ok := rawDependencies.([]interface{}); ok {
					for _, dep := range depsSlice {
						if depStr, ok := dep.(string); ok {
							task.Dependencies = append(task.Dependencies, depStr)
						}
					}
				}
			}

			tasks = append(tasks, task)
		}
	}

	return tasks
}

// normalizeResponsibles normalizes responsible persons data
func (dt *DataTransformer) normalizeResponsibles(rawResponsibles []interface{}) []ResponsiblePerson {
	responsibles := make([]ResponsiblePerson, 0, len(rawResponsibles))

	for _, rawResp := range rawResponsibles {
		if rawRespMap, ok := rawResp.(map[string]interface{}); ok {
			resp := ResponsiblePerson{
				Name:    dt.normalizeText(rawRespMap["name"]),
				Role:    dt.normalizeText(rawRespMap["role"]),
				Contact: dt.normalizeText(rawRespMap["contact"]),
			}

			// Only include if name exists
			if resp.Name != "" {
				responsibles = append(responsibles, resp)
			}
		}
	}

	return responsibles
}

// normalizeDate normalizes date to YYYY-MM-DD format
func (dt *DataTransformer) normalizeDate(dateValue interface{}) string {
	if dateValue == nil {
		return ""
	}

	dateStr := fmt.Sprintf("%v", dateValue)
	if dateStr == "" {
		return ""
	}

	// Handle numeric timestamps
	if num, err := strconv.ParseFloat(dateStr, 64); err == nil {
		// Assume it's a Unix timestamp
		t := time.Unix(int64(num), 0)
		return t.Format("2006-01-02")
	}

	// Try to parse the date
	if parsedDate, err := time.Parse("2006-01-02", dateStr); err == nil {
		return parsedDate.Format("2006-01-02")
	}

	// Try to parse with day-first format
	if parsedDate, err := time.Parse("02.01.2006", dateStr); err == nil {
		return parsedDate.Format("2006-01-02")
	}

	// Try to parse with US format
	if parsedDate, err := time.Parse("01/02/2006", dateStr); err == nil {
		return parsedDate.Format("2006-01-02")
	}

	// Try regex patterns
	for _, pattern := range dt.datePatterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(dateStr)
		if len(matches) > 0 {
			match := matches[0]
			// Try to parse the matched date
			if parsedDate, err := time.Parse("02.01.2006", match); err == nil {
				return parsedDate.Format("2006-01-02")
			}
			if parsedDate, err := time.Parse("2006-01-02", match); err == nil {
				return parsedDate.Format("2006-01-02")
			}
			if parsedDate, err := time.Parse("01/02/2006", match); err == nil {
				return parsedDate.Format("2006-01-02")
			}
		}
	}

	return ""
}

// normalizeText normalizes text content
func (dt *DataTransformer) normalizeText(text interface{}) string {
	if text == nil {
		return ""
	}

	textStr := fmt.Sprintf("%v", text)
	// Remove excessive whitespace and normalize line breaks
	re := regexp.MustCompile(`\s+`)
	textStr = re.ReplaceAllString(textStr, " ")
	return strings.TrimSpace(textStr)
}

// normalizeStatus normalizes task status
func (dt *DataTransformer) normalizeStatus(status interface{}) string {
	if status == nil {
		return "planned"
	}

	statusStr := strings.ToLower(dt.normalizeText(status))

	// Map various status representations to standard values
	statusMapping := map[string][]string{
		"planned":     {"planned", "planning", "not started", "в плане", "запланировано"},
		"in_progress": {"in_progress", "in progress", "progress", "в работе", "выполняется"},
		"completed":   {"completed", "done", "finished", "завершено", "выполнено", "complete"},
	}

	for standardStatus, variations := range statusMapping {
		for _, variation := range variations {
			if strings.Contains(statusStr, variation) {
				return standardStatus
			}
		}
	}

	return "planned" // Default to planned
}

// validateData validates data against schema
func (dt *DataTransformer) validateData(data *ProjectStructure) *ValidationResult {
	validationResult := &ValidationResult{
		IsValid:          true,
		Issues:           []string{},
		Warnings:         []string{},
		Suggestions:      []string{},
		ValidationStages: make(map[string]interface{}),
	}

	// Additional business logic validation
	businessValidation := dt.businessValidation(data)
	validationResult.Issues = append(validationResult.Issues, businessValidation.Issues...)
	validationResult.Warnings = append(validationResult.Warnings, businessValidation.Warnings...)

	if len(validationResult.Issues) > 0 {
		validationResult.IsValid = false
	}

	return validationResult
}

// businessValidation performs business logic validation
func (dt *DataTransformer) businessValidation(data *ProjectStructure) *ValidationResult {
	result := &ValidationResult{
		Issues:   []string{},
		Warnings: []string{},
	}

	// Validate date relationships
	for _, phase := range data.Project.Phases {
		if phase.StartDate != "" && phase.EndDate != "" {
			if startDate, err := time.Parse("2006-01-02", phase.StartDate); err == nil {
				if endDate, err := time.Parse("2006-01-02", phase.EndDate); err == nil {
					if startDate.After(endDate) {
						result.Warnings = append(result.Warnings,
							fmt.Sprintf("Phase '%s': Start date is after end date. Dates may need correction.", phase.Name))
					}
				}
			}
		}

		// Validate tasks within phase
		for _, task := range phase.Tasks {
			if task.StartDate != "" && task.EndDate != "" {
				if startDate, err := time.Parse("2006-01-02", task.StartDate); err == nil {
					if endDate, err := time.Parse("2006-01-02", task.EndDate); err == nil {
						if startDate.After(endDate) {
							result.Warnings = append(result.Warnings,
								fmt.Sprintf("Task '%s': Start date is after end date. Dates may need correction.", task.Name))
						}
					}
				}
			}
		}
	}

	// Validate dependency references
	allTaskIds := make(map[string]bool)
	for _, phase := range data.Project.Phases {
		for _, task := range phase.Tasks {
			allTaskIds[task.ID] = true
		}
	}

	for _, phase := range data.Project.Phases {
		for _, task := range phase.Tasks {
			for _, dep := range task.Dependencies {
				if !allTaskIds[dep] {
					result.Issues = append(result.Issues,
						fmt.Sprintf("Task '%s' has invalid dependency: %s", task.Name, dep))
				}
			}
		}
	}

	return result
}

// createPartialTransformation creates partial transformation when full validation fails
func (dt *DataTransformer) createPartialTransformation(data *ProjectStructure, validation *ValidationResult) *ProjectStructure {
	// For now, return nil to indicate complete failure
	// In a more sophisticated implementation, this would attempt
	// to fix validation errors and create a partially valid structure
	return nil
}

// calculateConfidenceScore calculates confidence score based on data quality
func (dt *DataTransformer) calculateConfidenceScore(data *ProjectStructure, validation *ValidationResult) float64 {
	score := 1.0

	// Reduce score based on validation issues
	score -= float64(len(validation.Issues)) * 0.2
	score -= float64(len(validation.Warnings)) * 0.05

	// Consider data completeness
	if data.Project.Title == "" {
		score -= 0.1
	}
	if data.Project.Description == "" {
		score -= 0.05
	}

	if len(data.Project.Phases) == 0 {
		score -= 0.3
	}

	// Consider task completeness
	totalTasks := 0
	for _, phase := range data.Project.Phases {
		totalTasks += len(phase.Tasks)
	}
	if totalTasks == 0 {
		score -= 0.2
	}

	// Ensure score stays within bounds
	if score < 0.0 {
		score = 0.0
	}
	if score > 1.0 {
		score = 1.0
	}

	return score
}
