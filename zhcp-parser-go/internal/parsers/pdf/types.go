package pdf

// StructureInfo represents the structure information of a document element
type StructureInfo struct {
	Page    int        `json:"page"`
	Type    string     `json:"type"` // "text", "table", "image", etc.
	Content string     `json:"content"`
	BBox    [4]float64 `json:"bbox"` // bounding box coordinates [x1, y1, x2, y2]
}

// PDFExtractionResult represents the result of PDF extraction
type PDFExtractionResult struct {
	Text      string                 `json:"text"`
	Metadata  map[string]interface{} `json:"metadata"`
	PageCount int                    `json:"page_count"`
	HasTables bool                   `json:"has_tables"`
	Structure []StructureInfo        `json:"structure"`
}

// ValidationResult represents the result of PDF validation
type ValidationResult struct {
	IsValid  bool     `json:"is_valid"`
	FileSize int64    `json:"file_size"`
	Errors   []string `json:"errors"`
}
