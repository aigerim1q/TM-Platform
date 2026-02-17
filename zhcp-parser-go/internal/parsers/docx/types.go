package docx

// FormattedElement represents a formatted element in a DOCX document
type FormattedElement struct {
	Index      int               `json:"index"`
	Text       string            `json:"text"`
	Style      string            `json:"style"`
	Properties ElementProperties `json:"properties"`
	Runs       []RunInfo         `json:"runs"`
	Type       string            `json:"type"` // "heading", "paragraph", "list_item", etc.
	Level      int               `json:"level,omitempty"`
}

// ElementProperties contains formatting properties of an element
type ElementProperties struct {
	Alignment   string          `json:"alignment"`
	Indentation IndentationInfo `json:"indentation"`
}

// IndentationInfo contains indentation information
type IndentationInfo struct {
	Left      interface{} `json:"left,omitempty"`
	Right     interface{} `json:"right,omitempty"`
	FirstLine interface{} `json:"first_line,omitempty"`
	Hanging   interface{} `json:"hanging,omitempty"`
}

// RunInfo contains information about a text run
type RunInfo struct {
	Text       string        `json:"text"`
	Formatting RunFormatting `json:"formatting"`
}

// RunFormatting contains formatting information for a text run
type RunFormatting struct {
	Bold      bool     `json:"bold"`
	Italic    bool     `json:"italic"`
	Underline bool     `json:"underline"`
	Font      FontInfo `json:"font"`
}

// FontInfo contains font information
type FontInfo struct {
	Name  string  `json:"name"`
	Size  float64 `json:"size"`
	Color string  `json:"color"`
}

// TableInfo represents information about a table in the document
type TableInfo struct {
	Index         int               `json:"index"`
	Rows          int               `json:"rows"`
	Columns       int               `json:"columns"`
	HeaderRow     []string          `json:"header_row"`
	DataRows      [][]string        `json:"data_rows"`
	CellStructure CellStructureInfo `json:"cell_structure"`
}

// CellStructureInfo contains information about table cell structure
type CellStructureInfo struct {
	HasMergedCells bool      `json:"has_merged_cells"`
	MergedRanges   []string  `json:"merged_ranges"`
	CellWidths     []float64 `json:"cell_widths"`
}

// ListInfo represents information about a list in the document
type ListInfo struct {
	Index   int      `json:"index"`
	Items   []string `json:"items"`
	Ordered bool     `json:"ordered"`
}

// ImageInfo represents information about an image in the document
type ImageInfo struct {
	Index       int    `json:"index"`
	AltText     string `json:"alt_text"`
	Description string `json:"description"`
}

// DOCXExtractionResult represents the result of DOCX extraction
type DOCXExtractionResult struct {
	Content struct {
		Text              string             `json:"text"`
		FormattedElements []FormattedElement `json:"formatted_elements"`
		Structure         []StructureElement `json:"structure"`
	} `json:"content"`
	Metadata map[string]interface{} `json:"metadata"`
	Tables   []TableInfo            `json:"tables"`
	Lists    []ListInfo             `json:"lists"`
	Images   []ImageInfo            `json:"images"` // metadata only
}

// StructureElement represents a structural element in the document
type StructureElement struct {
	Type    string      `json:"type"`
	Element interface{} `json:"element"`
}

// ValidationResult represents the result of DOCX validation
type ValidationResult struct {
	IsValid   bool     `json:"is_valid"`
	FileSize  int64    `json:"file_size"`
	Errors    []string `json:"errors"`
	IsZipFile bool     `json:"is_zip_file"`
}
