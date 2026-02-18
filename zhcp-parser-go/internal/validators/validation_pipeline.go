package validators

import (
	"fmt"

	"zhcp-parser-go/internal/transformers"
)

// ValidationPipeline represents a comprehensive validation pipeline with multiple stages
type ValidationPipeline struct {
	DocumentValidator    *DocumentValidator
	StructureValidator   *StructureValidator
	ConsistencyValidator *ConsistencyValidator
	ErrorHandler         interface{} // In a real implementation, we'd use a proper error handler
	logger               interface{} // In a real implementation, we'd use a proper logger
}

// NewValidationPipeline creates a new validation pipeline
func NewValidationPipeline() *ValidationPipeline {
	return &ValidationPipeline{
		DocumentValidator:    NewDocumentValidator(),
		StructureValidator:   NewStructureValidator(),
		ConsistencyValidator: NewConsistencyValidator(),
	}
}

// ValidateComplete runs complete validation pipeline
func (vp *ValidationPipeline) ValidateComplete(data map[string]interface{}, documentPath string) *ValidationResult {
	results := &ValidationResult{
		IsValid:          true,
		ValidationStages: make(map[string]interface{}),
		Issues:           []string{},
		Warnings:         []string{},
		QualityScore:     1.0,
	}

	// Stage 1: Document content validation
	content, ok := data["extracted_content"].(string)
	if !ok {
		content = ""
	}
	docType, ok := data["document_type"].(string)
	if !ok {
		docType = "unknown"
	}

	docResults := vp.DocumentValidator.ValidateDocumentContent(content, docType)
	results.ValidationStages["document_content"] = docResults

	if !docResults.IsValid {
		results.IsValid = false
		results.Issues = append(results.Issues, docResults.Issues...)
	}
	results.Suggestions = append(results.Suggestions, docResults.Suggestions...)

	// Stage 2: Structure validation
	projectStructure, ok := data["project_structure"].(*transformers.ProjectStructure)
	if !ok {
		projectStructure = &transformers.ProjectStructure{}
	}

	structureResults := vp.StructureValidator.ValidateStructure(projectStructure)
	results.ValidationStages["structure"] = structureResults

	if !structureResults.IsValid {
		results.IsValid = false
		results.Issues = append(results.Issues, structureResults.Issues...)
	}
	results.Warnings = append(results.Warnings, structureResults.Warnings...)

	// Stage 3: Consistency validation
	consistencyResults := vp.ConsistencyValidator.ValidateConsistency(projectStructure)
	results.ValidationStages["consistency"] = consistencyResults

	if !consistencyResults.IsValid {
		results.IsValid = false
		results.Issues = append(results.Issues, consistencyResults.Issues...)
	}
	results.Warnings = append(results.Warnings, consistencyResults.Warnings...)

	// Calculate overall quality score
	scores := []float64{
		docResults.QualityScore,
		structureResults.QualityScore,
	}

	totalScore := 0.0
	for _, score := range scores {
		totalScore += score
	}

	if len(scores) > 0 {
		results.QualityScore = totalScore / float64(len(scores))
	} else {
		results.QualityScore = 1.0
	}

	// Adjust confidence based on validation results
	results.ValidationStages["confidence_adjustment"] = vp.calculateConfidenceAdjustment(
		results.Issues, results.Warnings)

	return results
}

// calculateConfidenceAdjustment calculates confidence adjustment based on validation results
func (vp *ValidationPipeline) calculateConfidenceAdjustment(issues, warnings []string) float64 {
	adjustment := 0.0

	// Issues significantly reduce confidence
	adjustment -= float64(len(issues)) * 0.2

	// Warnings moderately reduce confidence
	adjustment -= float64(len(warnings)) * 0.05

	// Cap adjustment between -0.5 and 0 (don't increase confidence)
	if adjustment < -0.5 {
		adjustment = -0.5
	}
	if adjustment > 0 {
		adjustment = 0
	}

	return adjustment
}

// ValidateProjectStructure validates just the project structure
func (vp *ValidationPipeline) ValidateProjectStructure(projectStructure *transformers.ProjectStructure) *ValidationResult {
	data := map[string]interface{}{
		"project_structure": projectStructure,
		"extracted_content": "",
		"document_type":     "unknown",
	}

	return vp.ValidateComplete(data, "")
}

// GetValidationSummary provides a summary of validation results
func (vp *ValidationPipeline) GetValidationSummary(results *ValidationResult) map[string]interface{} {
	summary := make(map[string]interface{})

	summary["total_issues"] = len(results.Issues)
	summary["total_warnings"] = len(results.Warnings)
	summary["quality_score"] = results.QualityScore
	summary["is_valid"] = results.IsValid

	// Count issues by type
	issueCount := make(map[string]int)
	for _, issue := range results.Issues {
		// Simple categorization based on keywords
		if contains(issue, []string{"missing", "required"}) {
			issueCount["missing_fields"]++
		} else if contains(issue, []string{"duplicate", "ID"}) {
			issueCount["duplicate_ids"]++
		} else if contains(issue, "date") {
			issueCount["date_issues"]++
		} else {
			issueCount["other"]++
		}
	}

	summary["issue_breakdown"] = issueCount
	summary["confidence_adjustment"] = results.ValidationStages["confidence_adjustment"]

	return summary
}

// contains checks if a string contains any of the substrings
func contains(s string, substrs interface{}) bool {
	switch v := substrs.(type) {
	case string:
		return fmt.Sprintf("%s", s) != "" && s == v
	case []string:
		for _, substr := range v {
			if fmt.Sprintf("%s", s) != "" && s == substr {
				return true
			}
		}
	}
	return false
}
