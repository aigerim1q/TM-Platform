package transformers

// TransformationStatus represents the status of a transformation
type TransformationStatus string

const (
	TransformationStatusSuccess         TransformationStatus = "success"
	TransformationStatusPartial         TransformationStatus = "partial"
	TransformationStatusFailed          TransformationStatus = "failed"
	TransformationStatusValidationError TransformationStatus = "validation_error"
)

// TransformationResult represents the result of data transformation
type TransformationResult struct {
	TransformedData  *ProjectStructure    `json:"transformed_data,omitempty"`
	Status           TransformationStatus `json:"status"`
	ConfidenceScore  float64              `json:"confidence_score"`
	ValidationErrors []string             `json:"validation_errors"`
	ProcessingNotes  []string             `json:"processing_notes"`
	TokensUsed       TokenUsage           `json:"tokens_used,omitempty"`
}

// TokenUsage represents token usage information
type TokenUsage struct {
	Input  int `json:"input"`
	Output int `json:"output"`
	Total  int `json:"total"`
}

// ProjectStructure represents the main project structure
type ProjectStructure struct {
	Project  Project  `json:"project"`
	Metadata Metadata `json:"metadata,omitempty"`
}

// Project represents the main project
type Project struct {
	Title       string                 `json:"title" validate:"required"`
	Description string                 `json:"description" validate:"required"`
	Deadline    string                 `json:"deadline,omitempty"`
	Phases      []Phase                `json:"phases" validate:"required,min=1"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// Phase represents a project phase
type Phase struct {
	ID          string `json:"id" validate:"required"`
	Name        string `json:"name" validate:"required"`
	Description string `json:"description"`
	StartDate   string `json:"start_date,omitempty" validate:"omitempty,date_format"`
	EndDate     string `json:"end_date,omitempty" validate:"omitempty,date_format,date_after_start"`
	Tasks       []Task `json:"tasks"`
}

// Task represents a project task
type Task struct {
	ID                 string              `json:"id" validate:"required"`
	Name               string              `json:"name" validate:"required"`
	Description        string              `json:"description"`
	StartDate          string              `json:"start_date,omitempty" validate:"omitempty,date_format"`
	EndDate            string              `json:"end_date,omitempty" validate:"omitempty,date_format,date_after_start"`
	ResponsiblePersons []ResponsiblePerson `json:"responsible_persons"`
	Dependencies       []string            `json:"dependencies"`
	Status             string              `json:"status" validate:"oneof=planned in_progress completed"`
}

// ResponsiblePerson represents a person responsible for a task
type ResponsiblePerson struct {
	Name    string `json:"name"`
	Role    string `json:"role"`
	Contact string `json:"contact"`
}

// Metadata represents metadata for the project structure
type Metadata struct {
	SourceDocument    string      `json:"source_document"`
	ExtractionDate    string      `json:"extraction_date"`
	ConfidenceScore   float64     `json:"confidence_score"`
	ProcessingTime    float64     `json:"processing_time"`
	ValidationResults interface{} `json:"validation_results,omitempty"`
}

// ValidationResult represents the result of validation
type ValidationResult struct {
	IsValid          bool                   `json:"is_valid"`
	Issues           []string               `json:"issues"`
	QualityScore     float64                `json:"quality_score"`
	Warnings         []string               `json:"warnings"`
	Suggestions      []string               `json:"suggestions"`
	ValidationStages map[string]interface{} `json:"validation_stages"`
}
