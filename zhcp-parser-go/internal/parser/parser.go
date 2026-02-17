package parser

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"zhcp-parser-go/internal/ai"
	"zhcp-parser-go/internal/ai/prompt_engineering"
	"zhcp-parser-go/internal/common"
	"zhcp-parser-go/internal/errors"
	"zhcp-parser-go/internal/parsers"
	"zhcp-parser-go/internal/parsers/docx"
	"zhcp-parser-go/internal/parsers/pdf"
	"zhcp-parser-go/internal/transformers"
	"zhcp-parser-go/internal/validators"
)

// ZhcpParser is the main parser that orchestrates all components of the parsing system
type ZhcpParser struct {
	config             *common.Config
	pdfExtractor       *pdf.PDFExtractor
	pdfValidator       *pdf.PDFValidator
	docxExtractor      *docx.DOCXExtractor
	docxValidator      *docx.DOCXValidator
	textPreprocessor   *parsers.TextPreprocessor
	llmManager         *ai.LLMManager
	promptManager      *prompt_engineering.PromptManager
	dataTransformer    *transformers.DataTransformer
	dataEnricher       *transformers.DataEnricher
	validationPipeline *validators.ValidationPipeline
	errorHandler       *errors.ErrorHandler
	logger             interface{}  // In a real implementation, we'd use a proper logger interface
	mu                 sync.RWMutex // For thread safety
}

// NewZhcpParser creates a new ЖЦП parser
func NewZhcpParser(config *common.Config) (*ZhcpParser, error) {
	parser := &ZhcpParser{
		config: config,
	}

	// Initialize all components
	if err := parser.initializeComponents(); err != nil {
		return nil, fmt.Errorf("failed to initialize components: %w", err)
	}

	return parser, nil
}

// initializeComponents initializes all parser components
func (p *ZhcpParser) initializeComponents() error {
	var err error

	// Initialize document parsers
	p.pdfExtractor = pdf.NewPDFExtractor(p.logger)
	p.pdfValidator = pdf.NewPDFValidator()
	p.docxExtractor = docx.NewDOCXExtractor(p.logger)
	p.docxValidator = docx.NewDOCXValidator()
	p.textPreprocessor = parsers.NewTextPreprocessor()

	// Initialize LLM components
	p.llmManager, err = ai.NewLLMManager(p.config)
	if err != nil {
		return fmt.Errorf("failed to initialize LLM manager: %w", err)
	}

	// Initialize AI components
	p.promptManager = prompt_engineering.NewPromptManager("prompts/")

	// Initialize transformers
	p.dataTransformer = transformers.NewDataTransformer()
	p.dataEnricher = transformers.NewDataEnricher()

	// Initialize validators
	p.validationPipeline = validators.NewValidationPipeline()

	// Initialize error handler
	p.errorHandler = errors.NewErrorHandler("logs/errors.log", 1000)

	return nil
}

// ParseDocument parses a document and extracts project structure
func (p *ZhcpParser) ParseDocument(documentPath string, validate, enrich bool) (*ParseResult, error) {
	startTime := time.Now()

	// Determine document type and validate
	docType, err := p.getDocumentType(documentPath)
	if err != nil {
		return p.createErrorResult(err, documentPath, startTime), nil
	}

	// Validate document based on type
	if docType == "pdf" {
		validation, err := p.pdfValidator.ValidatePDF(documentPath)
		if err != nil {
			return p.createErrorResult(err, documentPath, startTime), nil
		}
		if !validation.IsValid {
			err := errors.NewParsingError(
				fmt.Sprintf("PDF validation failed: %s", strings.Join(validation.Errors, ", ")),
				documentPath,
				nil)
			return p.createErrorResult(err, documentPath, startTime), nil
		}
	} else { // docx
		validation, err := p.docxValidator.ValidateDOCX(documentPath)
		if err != nil {
			return p.createErrorResult(err, documentPath, startTime), nil
		}
		if !validation.IsValid {
			err := errors.NewParsingError(
				fmt.Sprintf("DOCX validation failed: %s", strings.Join(validation.Errors, ", ")),
				documentPath,
				nil)
			return p.createErrorResult(err, documentPath, startTime), nil
		}
	}

	// Extract content based on document type
	var extractionResult interface{}
	if docType == "pdf" {
		extractionResult, err = p.parsePDF(documentPath)
	} else {
		extractionResult, err = p.parseDOCX(documentPath)
	}
	if err != nil {
		return p.createErrorResult(err, documentPath, startTime), nil
	}

	// For simplicity in this implementation, we'll use a type assertion
	// In a real implementation, you'd have a common interface
	var extractedText string
	if pdfResult, ok := extractionResult.(*pdf.PDFExtractionResult); ok {
		extractedText = pdfResult.Text
	} else if docxResult, ok := extractionResult.(*docx.DOCXExtractionResult); ok {
		extractedText = docxResult.Content.Text
	} else {
		err := errors.NewParsingError("Unknown extraction result type", documentPath, nil)
		return p.createErrorResult(err, documentPath, startTime), nil
	}

	// Validate extracted content
	contentValidation := p.validationPipeline.DocumentValidator.ValidateDocumentContent(
		extractedText, docType)
	if !contentValidation.IsValid && len(contentValidation.Issues) > 0 {
		// Log content validation issues but don't fail the entire process
		// In a real implementation, you'd log these appropriately
	}

	// Create extraction prompt
	jsonSchema := p.getProjectJSONSchema()
	prompt, err := p.promptManager.CreateExtractionPrompt(extractedText, jsonSchema)
	if err != nil {
		return p.createErrorResult(err, documentPath, startTime), nil
	}

	// Generate response from LLM
	llmResponse, err := p.llmManager.GenerateWithFallback(context.Background(), ai.GenerationOptions{
		Temperature: 0.1,
		MaxTokens:   4096,
	}, prompt)
	if err != nil {
		return p.createErrorResult(err, documentPath, startTime), nil
	}

	// Transform LLM response to structured data
	transformationResult := p.dataTransformer.Transform(llmResponse.Content)

	if transformationResult.Status == transformers.TransformationStatusSuccess ||
		transformationResult.Status == transformers.TransformationStatusPartial {

		// Enrich the data if requested
		if enrich && transformationResult.TransformedData != nil {
			transformationResult.TransformedData = p.dataEnricher.EnrichData(transformationResult.TransformedData)
		}

		// Validate the result if requested
		if validate && transformationResult.TransformedData != nil {
			validationResults := p.validationPipeline.ValidateComplete(map[string]interface{}{
				"project_structure": transformationResult.TransformedData,
				"extracted_content": extractedText,
				"document_type":     docType,
			}, documentPath)

			// Adjust confidence based on validation
			if validationResults != nil {
				adjustment, ok := validationResults.ValidationStages["confidence_adjustment"].(float64)
				if ok {
					transformationResult.ConfidenceScore += adjustment
					if transformationResult.ConfidenceScore < 0.0 {
						transformationResult.ConfidenceScore = 0.0
					}
					if transformationResult.ConfidenceScore > 1.0 {
						transformationResult.ConfidenceScore = 1.0
					}
				}
			}
		}
	}

	// Prepare final result
	processingTime := time.Since(startTime).Seconds()

	result := &ParseResult{
		Success: transformationResult.Status == transformers.TransformationStatusSuccess ||
			transformationResult.Status == transformers.TransformationStatusPartial,
		ProjectStructure: transformationResult.TransformedData,
		ExtractionMetadata: ExtractionMetadata{
			Confidence:     transformationResult.ConfidenceScore,
			Status:         string(transformationResult.Status),
			ProcessingTime: processingTime,
		},
	}

	if len(transformationResult.ValidationErrors) > 0 {
		result.ValidationError = transformationResult.ValidationErrors
	}

	if len(transformationResult.ProcessingNotes) > 0 {
		result.ProcessingNotes = transformationResult.ProcessingNotes
	}

	return result, nil
}

// getDocumentType determines the document type based on file extension
func (p *ZhcpParser) getDocumentType(documentPath string) (string, error) {
	ext := strings.ToLower(filepath.Ext(documentPath))
	switch ext {
	case ".pdf":
		return "pdf", nil
	case ".docx":
		return "docx", nil
	default:
		return "", fmt.Errorf("unsupported document type: %s", ext)
	}
}

// parsePDF parses a PDF document
func (p *ZhcpParser) parsePDF(pdfPath string) (interface{}, error) {
	return p.pdfExtractor.ExtractText(pdfPath)
}

// parseDOCX parses a DOCX document
func (p *ZhcpParser) parseDOCX(docxPath string) (interface{}, error) {
	return p.docxExtractor.ExtractWithFormatting(docxPath)
}

// getProjectJSONSchema returns the expected JSON schema for project structure
func (p *ZhcpParser) getProjectJSONSchema() map[string]interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"project": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"title":       map[string]interface{}{"type": "string"},
					"description": map[string]interface{}{"type": "string"},
					"deadline":    map[string]interface{}{"type": []string{"string", "null"}},
					"phases": map[string]interface{}{
						"type": "array",
						"items": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"id":          map[string]interface{}{"type": "string"},
								"name":        map[string]interface{}{"type": "string"},
								"description": map[string]interface{}{"type": "string"},
								"start_date":  map[string]interface{}{"type": []string{"string", "null"}},
								"end_date":    map[string]interface{}{"type": []string{"string", "null"}},
								"tasks": map[string]interface{}{
									"type": "array",
									"items": map[string]interface{}{
										"type": "object",
										"properties": map[string]interface{}{
											"id":          map[string]interface{}{"type": "string"},
											"name":        map[string]interface{}{"type": "string"},
											"description": map[string]interface{}{"type": "string"},
											"start_date":  map[string]interface{}{"type": []string{"string", "null"}},
											"end_date":    map[string]interface{}{"type": []string{"string", "null"}},
											"responsible_persons": map[string]interface{}{
												"type": "array",
												"items": map[string]interface{}{
													"type": "object",
													"properties": map[string]interface{}{
														"name":    map[string]interface{}{"type": "string"},
														"role":    map[string]interface{}{"type": "string"},
														"contact": map[string]interface{}{"type": "string"},
													},
												},
											},
											"dependencies": map[string]interface{}{
												"type":  "array",
												"items": map[string]interface{}{"type": "string"},
											},
											"status": map[string]interface{}{"type": "string"},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

// createErrorResult creates an error result
func (p *ZhcpParser) createErrorResult(err error, documentPath string, startTime time.Time) *ParseResult {
	processingTime := time.Since(startTime).Seconds()

	// Handle both custom errors and standard errors
	var errorInfo *ErrorInfo
	if zhcpErr, ok := err.(errors.ZhcpError); ok {
		// If it's already a ZhcpError, create ErrorInfo from it
		zhcpErrorInfo := p.errorHandler.HandleError(zhcpErr, documentPath, "ZhcpParser")
		errorInfo = &ErrorInfo{
			ErrorID:         zhcpErrorInfo.ErrorID,
			Category:        string(zhcpErrorInfo.Category),
			Severity:        string(zhcpErrorInfo.Severity),
			Message:         zhcpErrorInfo.Message,
			Details:         zhcpErrorInfo.Details,
			Timestamp:       zhcpErrorInfo.Timestamp,
			DocumentPath:    zhcpErrorInfo.DocumentPath,
			Component:       zhcpErrorInfo.Component,
			Traceback:       zhcpErrorInfo.Traceback,
			SuggestedAction: zhcpErrorInfo.SuggestedAction,
		}
	} else {
		// For standard errors, wrap them
		zhcpErr := errors.NewParsingError(err.Error(), documentPath, nil)
		handlerErrorInfo := p.errorHandler.HandleError(zhcpErr, documentPath, "ZhcpParser")
		errorInfo = &ErrorInfo{
			ErrorID:         handlerErrorInfo.ErrorID,
			Category:        string(handlerErrorInfo.Category),
			Severity:        string(handlerErrorInfo.Severity),
			Message:         handlerErrorInfo.Message,
			Details:         handlerErrorInfo.Details,
			Timestamp:       handlerErrorInfo.Timestamp,
			DocumentPath:    handlerErrorInfo.DocumentPath,
			Component:       handlerErrorInfo.Component,
			Traceback:       handlerErrorInfo.Traceback,
			SuggestedAction: handlerErrorInfo.SuggestedAction,
		}
	}

	return &ParseResult{
		Success: false,
		ExtractionMetadata: ExtractionMetadata{
			ProcessingTime: processingTime,
		},
		Error: errorInfo,
	}
}

// determineSeverity determines the severity level for an error category
func (p *ZhcpParser) determineSeverity(category errors.ErrorCategory) errors.ErrorSeverity {
	severityMapping := map[errors.ErrorCategory]errors.ErrorSeverity{
		errors.ErrorCategoryParsing:        errors.ErrorSeverityError,
		errors.ErrorCategoryValidation:     errors.ErrorSeverityWarning,
		errors.ErrorCategoryLLM:            errors.ErrorSeverityError,
		errors.ErrorCategoryTransformation: errors.ErrorSeverityError,
		errors.ErrorCategoryConfiguration:  errors.ErrorSeverityCritical,
		errors.ErrorCategoryNetwork:        errors.ErrorSeverityError,
		errors.ErrorCategoryFile:           errors.ErrorSeverityError,
		errors.ErrorCategoryBusinessLogic:  errors.ErrorSeverityError,
		errors.ErrorCategoryGeneral:        errors.ErrorSeverityError,
	}

	if severity, exists := severityMapping[category]; exists {
		return severity
	}

	return errors.ErrorSeverityError // Default severity
}

// GetErrorSummary gets a summary of recent errors
func (p *ZhcpParser) GetErrorSummary() map[string]interface{} {
	return p.errorHandler.GetErrorSummary()
}

// Close closes the parser and any resources it holds
func (p *ZhcpParser) Close() error {
	// In a real implementation, you would close any resources here
	return nil
}
