package pdf

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
)

// PDFExtractor handles PDF text extraction with fallback mechanisms
type PDFExtractor struct {
	logger interface{} // In a real implementation, we'd use a proper logger interface
}

// NewPDFExtractor creates a new PDF extractor
func NewPDFExtractor(logger interface{}) *PDFExtractor {
	return &PDFExtractor{
		logger: logger,
	}
}

// ExtractText extracts text from PDF with fallback mechanisms
func (e *PDFExtractor) ExtractText(pdfPath string) (*PDFExtractionResult, error) {
	result := &PDFExtractionResult{
		Metadata:  make(map[string]interface{}),
		Structure: []StructureInfo{},
	}

	// Check if file exists
	if _, err := os.Stat(pdfPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("PDF file does not exist: %s", pdfPath)
	}

	// For this implementation, we'll simulate PDF text extraction
	// In a real implementation, you would use a library like pdfcpu, unidoc, etc.

	// Open and read the file to check if it's a valid PDF
	file, err := os.Open(pdfPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open PDF file: %w", err)
	}
	defer file.Close()

	// Check PDF header
	scanner := bufio.NewScanner(file)
	if scanner.Scan() {
		header := scanner.Text()
		if !strings.HasPrefix(header, "%PDF-") {
			return nil, fmt.Errorf("file is not a valid PDF: missing PDF header")
		}
	}

	// Reset file pointer and read content
	content, err := os.ReadFile(pdfPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read PDF file: %w", err)
	}

	// This is a simplified approach - in a real implementation you'd use a proper PDF library
	// For now, we'll extract text using regex patterns to find text within PDF format
	text := extractTextFromPDFBytes(content)

	result.Text = text
	result.PageCount = 1 // Simplified - in real implementation, count actual pages
	result.HasTables = e.hasTables(result.Text)

	// Add basic structure information
	structureInfo := StructureInfo{
		Page:    1,
		Type:    "text",
		Content: "PDF content extracted",
	}
	result.Structure = append(result.Structure, structureInfo)

	return result, nil
}

// hasTables checks if the text contains table-like patterns
func (e *PDFExtractor) hasTables(text string) bool {
	lines := strings.Split(text, "\n")
	tableIndicators := 0

	for _, line := range lines {
		// Look for lines with multiple separators like | or tab characters
		if strings.Contains(line, "|") || strings.Contains(line, "\t") {
			tableIndicators++
		}

		// Look for patterns that suggest tables (multiple columns)
		parts := strings.Fields(line)
		if len(parts) > 3 { // More than 3 columns likely indicates a table
			tableIndicators++
		}
	}

	return tableIndicators > 2 // If we found more than 2 table indicators, assume there are tables
}

// ExtractTables extracts tables from PDF
func (e *PDFExtractor) ExtractTables(pdfPath string) ([][]string, error) {
	// Extract text first
	result, err := e.ExtractText(pdfPath)
	if err != nil {
		return nil, err
	}

	// This is a simplified implementation - in a real implementation, you'd use
	// more sophisticated table detection algorithms
	tables := [][]string{}

	text := result.Text
	lines := strings.Split(text, "\n")

	var currentTable []string
	inTable := false

	for _, line := range lines {
		// Simple detection: if line contains table separators
		if strings.Contains(line, "|") || strings.Contains(line, "\t") {
			if !inTable {
				inTable = true
				currentTable = []string{}
			}
			currentTable = append(currentTable, line)
		} else if inTable && strings.TrimSpace(line) == "" {
			// Empty line after table, end the table
			if len(currentTable) > 0 {
				tables = append(tables, currentTable)
				currentTable = []string{}
				inTable = false
			}
		} else if inTable {
			// Non-table line while in table mode, end the table
			tables = append(tables, currentTable)
			currentTable = []string{}
			inTable = false
		}
	}

	// Add the last table if it exists
	if inTable && len(currentTable) > 0 {
		tables = append(tables, currentTable)
	}

	return tables, nil
}

// extractTextFromPDFBytes extracts text from PDF bytes using regex patterns
// This is a basic implementation that looks for text patterns in PDF format
func extractTextFromPDFBytes(content []byte) string {
	// Convert to string
	contentStr := string(content)

	// Look for text between parentheses (PDF text format: (text))
	// Pattern: \( followed by text followed by \)
	parenPattern := regexp.MustCompile(`\((.*?)\)`)
	matches := parenPattern.FindAllStringSubmatch(contentStr, -1)

	var extractedText strings.Builder
	for _, match := range matches {
		if len(match) > 1 {
			text := match[1]
			// Skip short matches that are likely not actual text
			if len(text) > 2 {
				extractedText.WriteString(text)
				extractedText.WriteString(" ")
			}
		}
	}

	// Also look for text between angle brackets (PDF hex text format)
	hexPattern := regexp.MustCompile(`<(?:[0-9a-fA-F]{2})+>`)
	hexMatches := hexPattern.FindAllString(contentStr, -1)

	// For hex text, we would need to convert hex to characters
	// This is a simplified implementation
	for _, hexText := range hexMatches {
		// Remove < and > characters
		hexStr := strings.ReplaceAll(hexText, "<", "")
		hexStr = strings.ReplaceAll(hexStr, ">", "")

		// Convert hex string to text (simplified approach)
		if len(hexStr)%2 == 0 {
			var hexConverted strings.Builder
			for i := 0; i < len(hexStr); i += 2 {
				// This is a simplified conversion - in reality, you'd properly decode hex
				hexPair := hexStr[i : i+2]
				if byteVal, err := strconv.ParseInt(hexPair, 16, 8); err == nil && byteVal >= 32 && byteVal <= 126 {
					hexConverted.WriteByte(byte(byteVal))
				}
			}
			if hexConverted.Len() > 2 { // Only add if it's meaningful text
				extractedText.WriteString(hexConverted.String())
				extractedText.WriteString(" ")
			}
		}
	}

	// Clean up the text by removing control characters but keeping readable text
	finalText := extractedText.String()
	var cleanedText strings.Builder
	for _, r := range finalText {
		if (r >= ' ' && r <= '~') || r == '\n' || r == '\r' || r == '\t' {
			cleanedText.WriteRune(r)
		} else if r >= 1040 && r <= 1103 { // Cyrillic characters
			cleanedText.WriteRune(r)
		}
	}

	return cleanedText.String()
}
