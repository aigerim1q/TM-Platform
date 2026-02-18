package parser

import (
	"time"

	"zhcp-parser-go/internal/transformers"
	"zhcp-parser-go/internal/validators"
)

// ParseResult represents the result of document parsing
type ParseResult struct {
	Success            bool                           `json:"success"`
	ProjectStructure   *transformers.ProjectStructure `json:"project_structure,omitempty"`
	ExtractionMetadata ExtractionMetadata             `json:"extraction_metadata"`
	ValidationError    []string                       `json:"validation_errors,omitempty"`
	ProcessingNotes    []string                       `json:"processing_notes,omitempty"`
	Error              *ErrorInfo                     `json:"error,omitempty"`
}

// ExtractionMetadata contains metadata about the extraction process
type ExtractionMetadata struct {
	Confidence        float64                      `json:"confidence"`
	Status            string                       `json:"status"`
	ProcessingTime    float64                      `json:"processing_time"`
	ValidationResults *validators.ValidationResult `json:"validation_results,omitempty"`
}

// ErrorInfo represents error information
type ErrorInfo struct {
	ErrorID         string                 `json:"error_id"`
	Category        string                 `json:"category"`
	Severity        string                 `json:"severity"`
	Message         string                 `json:"message"`
	Details         map[string]interface{} `json:"details"`
	Timestamp       time.Time              `json:"timestamp"`
	DocumentPath    *string                `json:"document_path,omitempty"`
	Component       *string                `json:"component,omitempty"`
	Traceback       *string                `json:"traceback,omitempty"`
	SuggestedAction *string                `json:"suggested_action,omitempty"`
}
