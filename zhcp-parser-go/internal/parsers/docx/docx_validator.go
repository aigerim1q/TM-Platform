package docx

import (
	"archive/zip"
	"fmt"
	"os"
	"strings"
)

// DOCXValidator validates DOCX files before processing
type DOCXValidator struct{}

// NewDOCXValidator creates a new DOCX validator
func NewDOCXValidator() *DOCXValidator {
	return &DOCXValidator{}
}

// ValidateDOCX validates DOCX file before processing
func (v *DOCXValidator) ValidateDOCX(docxPath string) (*ValidationResult, error) {
	validationResult := &ValidationResult{
		IsValid:   false,
		FileSize:  0,
		Errors:    []string{},
		IsZipFile: false,
	}

	// Check if file exists
	if _, err := os.Stat(docxPath); os.IsNotExist(err) {
		validationResult.Errors = append(validationResult.Errors, "File does not exist")
		return validationResult, nil
	}

	// Check file size
	fileInfo, err := os.Stat(docxPath)
	if err != nil {
		validationResult.Errors = append(validationResult.Errors, fmt.Sprintf("Error getting file info: %v", err))
		return validationResult, nil
	}

	fileSize := fileInfo.Size()
	validationResult.FileSize = fileSize

	// Check file size limit (50MB)
	if fileSize > 50*1024*1024 { // 50MB
		validationResult.Errors = append(validationResult.Errors, "File size exceeds 50MB limit")
	}

	// Check file extension
	if !isDOCXFile(docxPath) {
		validationResult.Errors = append(validationResult.Errors, "File is not a DOCX")
	}

	// Check if it's a valid zip file (DOCX is a zip archive)
	file, err := os.Open(docxPath)
	if err != nil {
		validationResult.Errors = append(validationResult.Errors, fmt.Sprintf("Error opening file: %v", err))
		return validationResult, nil
	}
	defer file.Close()

	// Try to read as zip file
	zipReader, err := zip.NewReader(file, fileInfo.Size())
	if err != nil {
		validationResult.Errors = append(validationResult.Errors, "File is not a valid zip archive")
		return validationResult, nil
	}

	// Check if it contains required DOCX files
	requiredFiles := []string{"word/document.xml", "word/_rels/document.xml.rels"}
	docxFiles := make([]string, len(zipReader.File))
	for i, file := range zipReader.File {
		docxFiles[i] = file.Name
	}

	hasRequiredFiles := true
	for _, requiredFile := range requiredFiles {
		found := false
		for _, docxFile := range docxFiles {
			if docxFile == requiredFile {
				found = true
				break
			}
		}
		if !found {
			hasRequiredFiles = false
			validationResult.Errors = append(validationResult.Errors, fmt.Sprintf("Missing required file: %s", requiredFile))
		}
	}

	if hasRequiredFiles {
		validationResult.IsValid = true
		validationResult.IsZipFile = true
	}

	return validationResult, nil
}

// isDOCXFile checks if the file has a DOCX extension
func isDOCXFile(filePath string) bool {
	return len(filePath) > 5 &&
		(strings.ToLower(filePath[len(filePath)-5:]) == ".docx")
}
