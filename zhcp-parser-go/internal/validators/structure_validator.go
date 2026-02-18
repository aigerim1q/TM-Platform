package validators

import (
	"fmt"
	"reflect"

	"zhcp-parser-go/internal/transformers"
)

// StructureValidator validates extracted project structure
type StructureValidator struct {
	requiredFields map[string][]string
}

// NewStructureValidator creates a new structure validator
func NewStructureValidator() *StructureValidator {
	return &StructureValidator{
		requiredFields: map[string][]string{
			"project": {"title", "phases"},
			"phase":   {"id", "name"},
			"task":    {"id", "name"},
		},
	}
}

// ValidateStructure validates project structure completeness
func (sv *StructureValidator) ValidateStructure(structure *transformers.ProjectStructure) *StructureValidationResult {
	results := &StructureValidationResult{
		IsValid:      true,
		Issues:       []string{},
		QualityScore: 1.0,
		Warnings:     []string{},
		Suggestions:  []string{},
	}

	// Validate project level
	project := structure.Project

	// Check required project fields
	for _, field := range sv.requiredFields["project"] {
		if !sv.hasValue(project, field) {
			results.Issues = append(results.Issues, fmt.Sprintf("Missing required project field: %s", field))
			results.IsValid = false
		}
	}

	// Validate phases
	phases := project.Phases
	if len(phases) == 0 {
		results.Issues = append(results.Issues, "No phases found in project")
		results.IsValid = false
	}

	for i, phase := range phases {
		// Check required phase fields
		for _, field := range sv.requiredFields["phase"] {
			if !sv.hasValue(phase, field) {
				results.Issues = append(results.Issues, fmt.Sprintf("Phase %d missing required field: %s", i, field))
				results.IsValid = false
			}
		}

		// Validate tasks within phase
		tasks := phase.Tasks
		for j, task := range tasks {
			for _, field := range sv.requiredFields["task"] {
				if !sv.hasValue(task, field) {
					results.Issues = append(results.Issues, fmt.Sprintf("Task %d in phase %d missing required field: %s", j, i, field))
					results.IsValid = false
				}
			}
		}
	}

	// Calculate quality score based on completeness
	results.QualityScore = sv.calculateCompletenessScore(structure)

	return results
}

// calculateCompletenessScore calculates completeness score for structure
func (sv *StructureValidator) calculateCompletenessScore(structure *transformers.ProjectStructure) float64 {
	totalChecks := 0
	passedChecks := 0

	project := structure.Project

	// Check project fields
	for _, field := range sv.requiredFields["project"] {
		totalChecks++
		if sv.hasValue(project, field) {
			passedChecks++
		}
	}

	// Check phases and tasks
	phases := project.Phases
	for _, phase := range phases {
		for _, field := range sv.requiredFields["phase"] {
			totalChecks++
			if sv.hasValue(phase, field) {
				passedChecks++
			}
		}

		tasks := phase.Tasks
		for _, task := range tasks {
			for _, field := range sv.requiredFields["task"] {
				totalChecks++
				if sv.hasValue(task, field) {
					passedChecks++
				}
			}
		}
	}

	if totalChecks == 0 {
		return 0.0
	}

	return float64(passedChecks) / float64(totalChecks)
}

// hasValue checks if a field has a non-empty value
func (sv *StructureValidator) hasValue(obj interface{}, fieldName string) bool {
	v := reflect.ValueOf(obj)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}

	if v.Kind() != reflect.Struct {
		return false
	}

	field := v.FieldByName(fieldName)
	if !field.IsValid() {
		return false
	}

	switch field.Kind() {
	case reflect.String:
		return field.String() != ""
	case reflect.Slice:
		return field.Len() > 0
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return field.Int() != 0
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return field.Uint() != 0
	case reflect.Float32, reflect.Float64:
		return field.Float() != 0
	case reflect.Bool:
		return field.Bool()
	default:
		return !field.IsZero()
	}
}
