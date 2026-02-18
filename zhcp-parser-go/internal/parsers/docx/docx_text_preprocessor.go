package docx

import (
	"regexp"
	"strings"
)

// DOCXTextPreprocessor handles DOCX-specific text preprocessing
type DOCXTextPreprocessor struct{}

// NewDOCXTextPreprocessor creates a new DOCX text preprocessor
func NewDOCXTextPreprocessor() *DOCXTextPreprocessor {
	return &DOCXTextPreprocessor{}
}

// CleanText cleans extracted DOCX text for LLM processing
func (tp *DOCXTextPreprocessor) CleanText(text string) string {
	// Remove excessive whitespace
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")

	// Remove special characters that might be formatting artifacts
	text = strings.ReplaceAll(text, "\x0b", " ") // Vertical tab
	text = strings.ReplaceAll(text, "\x0c", " ") // Form feed

	// Normalize line breaks
	text = regexp.MustCompile(`\n\s*\n`).ReplaceAllString(text, "\n\n")

	// Remove extra spaces around punctuation
	text = regexp.MustCompile(`\s+([,.!?;:])`).ReplaceAllString(text, "$1")

	return strings.TrimSpace(text)
}

// PreserveDocumentStructure preserves document structure while creating text for LLM
func (tp *DOCXTextPreprocessor) PreserveDocumentStructure(elements []FormattedElement) string {
	var structuredText strings.Builder

	for _, para := range elements {
		text := para.Text
		paraType := para.Type

		switch paraType {
		case "heading":
			// Add markers for headings
			level := para.Level
			if level == 0 {
				level = 1
			}
			headerMarker := strings.Repeat("#", level)
			structuredText.WriteString(headerMarker + " " + text + "\n")
		case "list_item", "numbered_list_item":
			// Preserve list structure
			structuredText.WriteString("• " + text + "\n")
		default:
			// Regular paragraph
			structuredText.WriteString(text + "\n")
		}
	}

	return strings.TrimSpace(structuredText.String())
}
