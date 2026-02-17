package docx

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"strings"
)

// DOCXExtractor handles DOCX text extraction with formatting information
type DOCXExtractor struct {
	logger interface{} // In a real implementation, we'd use a proper logger interface
}

// NewDOCXExtractor creates a new DOCX extractor
func NewDOCXExtractor(logger interface{}) *DOCXExtractor {
	return &DOCXExtractor{
		logger: logger,
	}
}

// ExtractWithFormatting extracts content with detailed formatting information
func (e *DOCXExtractor) ExtractWithFormatting(docxPath string) (*DOCXExtractionResult, error) {
	result := &DOCXExtractionResult{
		Metadata: make(map[string]interface{}),
		Tables:   []TableInfo{},
		Lists:    []ListInfo{},
		Images:   []ImageInfo{},
	}

	// Check if file exists
	if _, err := os.Stat(docxPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("DOCX file does not exist: %s", docxPath)
	}

	// Open the DOCX file (it's a zip archive)
	docxFile, err := os.Open(docxPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open DOCX file: %w", err)
	}
	defer docxFile.Close()

	// Get file info to check size
	fileInfo, err := docxFile.Stat()
	if err != nil {
		return nil, fmt.Errorf("failed to get file info: %w", err)
	}

	// Create zip reader
	zipReader, err := zip.NewReader(docxFile, fileInfo.Size())
	if err != nil {
		return nil, fmt.Errorf("failed to create zip reader: %w", err)
	}

	// Check if it contains required DOCX files
	requiredFiles := []string{"word/document.xml", "word/_rels/document.xml.rels"}

	// Check if required files exist
	hasRequiredFiles := true
	for _, requiredFile := range requiredFiles {
		found := false
		for _, file := range zipReader.File {
			if file.Name == requiredFile {
				found = true
				break
			}
		}
		if !found {
			hasRequiredFiles = false
			break
		}
	}

	if !hasRequiredFiles {
		return nil, fmt.Errorf("not a valid DOCX structure: missing required files")
	}

	// For this simplified implementation, we'll extract the main document content
	documentXML, err := e.extractDocumentXML(zipReader)
	if err != nil {
		return nil, fmt.Errorf("failed to extract document XML: %w", err)
	}

	// Extract text content from XML
	textContent := e.extractTextFromXML(documentXML)

	// Build result
	result.Content.Text = textContent

	// Add basic formatted elements (in a real implementation, you'd parse the XML properly)
	elements := []FormattedElement{
		{
			Index: 0,
			Text:  textContent,
			Type:  "paragraph",
		},
	}
	result.Content.FormattedElements = elements

	// Add basic structure
	structureElements := []StructureElement{
		{
			Type:    "paragraph",
			Element: textContent,
		},
	}
	result.Content.Structure = structureElements

	// Extract metadata
	result.Metadata = e.extractMetadata(zipReader)

	return result, nil
}

// extractDocumentXML extracts the main document XML from the DOCX archive
func (e *DOCXExtractor) extractDocumentXML(zipReader *zip.Reader) (string, error) {
	for _, file := range zipReader.File {
		if file.Name == "word/document.xml" {
			rc, err := file.Open()
			if err != nil {
				return "", err
			}
			defer rc.Close()

			content, err := io.ReadAll(rc)
			if err != nil {
				return "", err
			}

			return string(content), nil
		}
	}

	return "", fmt.Errorf("document.xml not found in DOCX archive")
}

// extractTextFromXML extracts plain text from the DOCX XML content
func (e *DOCXExtractor) extractTextFromXML(xmlContent string) string {
	// This is a simplified text extraction - in a real implementation you'd use
	// proper XML parsing to extract text while preserving structure

	// Remove XML tags to get plain text
	var text strings.Builder
	inTag := false
	for _, char := range xmlContent {
		if char == '<' {
			inTag = true
			continue
		}
		if char == '>' {
			inTag = false
			continue
		}
		if !inTag {
			text.WriteRune(char)
		}
	}

	// Clean up the text
	cleanedText := strings.ReplaceAll(text.String(), "\n", " ")
	cleanedText = strings.ReplaceAll(cleanedText, "\t", " ")
	cleanedText = strings.ReplaceAll(cleanedText, "\r", " ")

	// Replace multiple spaces with single space
	for strings.Contains(cleanedText, "  ") {
		cleanedText = strings.ReplaceAll(cleanedText, "  ", " ")
	}

	return strings.TrimSpace(cleanedText)
}

// extractMetadata extracts document metadata from the DOCX archive
func (e *DOCXExtractor) extractMetadata(zipReader *zip.Reader) map[string]interface{} {
	metadata := make(map[string]interface{})

	// Try to read core properties
	for _, file := range zipReader.File {
		if file.Name == "docProps/core.xml" {
			rc, err := file.Open()
			if err != nil {
				continue
			}

			_, err = io.ReadAll(rc)
			rc.Close()
			if err != nil {
				continue
			}

			// In a real implementation, you'd properly parse the XML
			// For now, we'll just add a placeholder
			metadata["has_core_props"] = true
			break
		}
	}

	return metadata
}
