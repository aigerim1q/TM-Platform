package validators

import (
	"strings"
	"unicode"
)

// DocumentValidator validates document content quality
type DocumentValidator struct{}

// NewDocumentValidator creates a new document validator
func NewDocumentValidator() *DocumentValidator {
	return &DocumentValidator{}
}

// ValidateDocumentContent validates document content quality
func (dv *DocumentValidator) ValidateDocumentContent(content, docType string) *DocumentValidationResult {
	results := &DocumentValidationResult{
		IsValid:      true,
		Issues:       []string{},
		QualityScore: 1.0,
		Suggestions:  []string{},
	}

	if content == "" || len(strings.TrimSpace(content)) < 100 {
		results.IsValid = false
		results.Issues = append(results.Issues, "Document content is too short")
		results.QualityScore = 0.1
	}

	// Check for null bytes (possible corruption)
	if strings.Contains(content, "\x00") {
		results.Issues = append(results.Issues, "Document contains null bytes (possible corruption)")
		results.QualityScore *= 0.5
	}

	// Check for Cyrillic content (expected for ЖЦП)
	cyrillicChars := 0
	totalChars := 0

	for _, char := range content {
		if unicode.IsLetter(char) {
			totalChars++
			if (char >= 'А' && char <= 'Я') || (char >= 'а' && char <= 'я') {
				cyrillicChars++
			}
		}
	}

	if totalChars > 0 {
		cyrillicRatio := float64(cyrillicChars) / float64(totalChars)
		if cyrillicRatio < 0.3 { // Less than 30% Cyrillic
			results.Suggestions = append(results.Suggestions,
				"Document may not contain expected Russian content for ЖЦП")
		}
	}

	if results.QualityScore > 1.0 {
		results.QualityScore = 1.0
	}

	return results
}
