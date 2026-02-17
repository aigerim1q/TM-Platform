package validators

// ValidationResult represents the result of validation
type ValidationResult struct {
	IsValid          bool                   `json:"is_valid"`
	Issues           []string               `json:"issues"`
	QualityScore     float64                `json:"quality_score"`
	Warnings         []string               `json:"warnings"`
	Suggestions      []string               `json:"suggestions"`
	ValidationStages map[string]interface{} `json:"validation_stages"`
}

// DocumentValidationResult represents the result of document content validation
type DocumentValidationResult struct {
	IsValid      bool     `json:"is_valid"`
	Issues       []string `json:"issues"`
	QualityScore float64  `json:"quality_score"`
	Suggestions  []string `json:"suggestions"`
}

// StructureValidationResult represents the result of structure validation
type StructureValidationResult struct {
	IsValid      bool     `json:"is_valid"`
	Issues       []string `json:"issues"`
	QualityScore float64  `json:"quality_score"`
	Warnings     []string `json:"warnings"`
	Suggestions  []string `json:"suggestions"`
}

// ConsistencyValidationResult represents the result of consistency validation
type ConsistencyValidationResult struct {
	IsValid     bool     `json:"is_valid"`
	Issues      []string `json:"issues"`
	Warnings    []string `json:"warnings"`
	Suggestions []string `json:"suggestions"`
}
