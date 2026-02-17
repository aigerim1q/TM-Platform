package parsers

import (
	"regexp"
	"strings"
)

// TextPreprocessor handles text cleaning and preprocessing
type TextPreprocessor struct{}

// NewTextPreprocessor creates a new text preprocessor
func NewTextPreprocessor() *TextPreprocessor {
	return &TextPreprocessor{}
}

// CleanText removes artifacts and normalizes text
func (tp *TextPreprocessor) CleanText(text string) string {
	// Remove excessive whitespace
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")

	// Handle common PDF artifacts
	text = strings.ReplaceAll(text, "\n", " ")
	text = strings.TrimSpace(text)

	// Normalize Cyrillic characters (if needed)
	text = strings.ReplaceAll(text, "ё", "е")

	// Remove page numbers if they appear as standalone numbers
	text = regexp.MustCompile(`\b\d{1,3}\b\s*$`).ReplaceAllString(text, "")

	return text
}

// PreserveStructure maintains document hierarchy for LLM processing
func (tp *TextPreprocessor) PreserveStructure(text string) string {
	// Maintain paragraph breaks
	text = regexp.MustCompile(`\n\s*\n`).ReplaceAllString(text, "\n\n")

	// Identify headers and sections
	lines := strings.Split(text, "\n")
	var processedLines []string

	for _, line := range lines {
		stripped := strings.TrimSpace(line)
		if stripped != "" {
			// Check if line looks like a header (all caps or starts with caps)
			if tp.isHeader(stripped) {
				processedLines = append(processedLines, "[HEADER] "+stripped+" [HEADER]")
			} else {
				processedLines = append(processedLines, stripped)
			}
		}
	}

	return strings.Join(processedLines, "\n")
}

// isHeader determines if a line is likely a header
func (tp *TextPreprocessor) isHeader(line string) bool {
	// If the line is short and mostly uppercase, it's likely a header
	if len(line) < 50 {
		upperCount := 0
		for _, char := range line {
			if char >= 'A' && char <= 'Z' {
				upperCount++
			} else if char >= 'А' && char <= 'Я' { // Cyrillic uppercase
				upperCount++
			}
		}
		return upperCount > len(line)/2
	}

	return false
}

// NormalizeCyrillic handles common Cyrillic character variations
func (tp *TextPreprocessor) NormalizeCyrillic(text string) string {
	// Replace common variations
	text = strings.ReplaceAll(text, "ё", "е")
	text = strings.ReplaceAll(text, "Ё", "Е")
	return text
}
