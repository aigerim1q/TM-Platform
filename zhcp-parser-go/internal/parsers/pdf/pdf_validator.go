package pdf

import (
	"fmt"
	"os"
)

// PDFValidator validates PDF files before processing
type PDFValidator struct{}

// NewPDFValidator creates a new PDF validator
func NewPDFValidator() *PDFValidator {
	return &PDFValidator{}
}

// ValidatePDF validates PDF file before processing
func (v *PDFValidator) ValidatePDF(pdfPath string) (*ValidationResult, error) {
	validationResult := &ValidationResult{
		IsValid:  false,
		FileSize: 0,
		Errors:   []string{},
	}

	// Check if file exists
	if _, err := os.Stat(pdfPath); os.IsNotExist(err) {
		validationResult.Errors = append(validationResult.Errors, "File does not exist")
		return validationResult, nil
	}

	// Check file size
	fileInfo, err := os.Stat(pdfPath)
	if err != nil {
		validationResult.Errors = append(validationResult.Errors, fmt.Sprintf("Error getting file info: %v", err))
		return validationResult, nil
	}

	fileSize := fileInfo.Size()
	validationResult.FileSize = fileSize

	// Check file size limit (100MB)
	if fileSize > 100*1024*1024 { // 100MB
		validationResult.Errors = append(validationResult.Errors, "File size exceeds 100MB limit")
	}

	// Check file extension
	if !isPDFFile(pdfPath) {
		validationResult.Errors = append(validationResult.Errors, "File is not a PDF")
	}

	// Check if it's a valid PDF by checking the header
	file, err := os.Open(pdfPath)
	if err != nil {
		validationResult.Errors = append(validationResult.Errors, fmt.Sprintf("Error opening file: %v", err))
		return validationResult, nil
	}
	defer file.Close()

	// Read the first few bytes to check for PDF header
	header := make([]byte, 4)
	_, err = file.Read(header)
	if err != nil {
		validationResult.Errors = append(validationResult.Errors, fmt.Sprintf("Error reading file header: %v", err))
		return validationResult, nil
	}

	// Check for PDF header "%PDF"
	if string(header) != "%PDF" {
		validationResult.Errors = append(validationResult.Errors, "File is not a valid PDF")
	} else {
		validationResult.IsValid = true
	}

	return validationResult, nil
}

// isPDFFile checks if the file has a PDF extension
func isPDFFile(filePath string) bool {
	return len(filePath) > 4 &&
		(filePath[len(filePath)-4:] == ".pdf" || filePath[len(filePath)-4:] == ".PDF")
}
