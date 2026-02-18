package errors

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// ErrorHandler handles errors throughout the system
type ErrorHandler struct {
	logFile   string
	maxErrors int
	errorLog  []*ErrorInfo
	logger    interface{}  // In a real implementation, we'd use a proper logger interface
	mutex     sync.RWMutex // For thread safety
}

// NewErrorHandler creates a new error handler
func NewErrorHandler(logFile string, maxErrors int) *ErrorHandler {
	// Create directory if it doesn't exist
	dir := filepath.Dir(logFile)
	if err := os.MkdirAll(dir, 0755); err != nil {
		// If we can't create the directory, use a default log file
		logFile = "logs/errors.log"
	}

	return &ErrorHandler{
		logFile:   logFile,
		maxErrors: maxErrors,
		errorLog:  make([]*ErrorInfo, 0),
	}
}

// HandleError processes an error and returns comprehensive error information
func (eh *ErrorHandler) HandleError(err error, documentPath, component string) *ErrorInfo {
	eh.mutex.Lock()
	defer eh.mutex.Unlock()

	errorInfo := eh.createErrorInfo(err, documentPath, component)

	// Log the error
	if err := eh.logError(errorInfo); err != nil {
		// If we can't log the error, at least return the error info
		fmt.Fprintf(os.Stderr, "Failed to log error: %v\n", err)
	}

	// Store in memory (with rotation)
	eh.errorLog = append(eh.errorLog, errorInfo)
	if len(eh.errorLog) > eh.maxErrors {
		eh.errorLog = eh.errorLog[1:] // Remove oldest error
	}

	return errorInfo
}

// createErrorInfo creates error information from any error type
func (eh *ErrorHandler) createErrorInfo(err error, documentPath, component string) *ErrorInfo {
	var category ErrorCategory
	var details map[string]interface{}
	var message string

	if zhcpErr, ok := err.(ZhcpError); ok {
		category = zhcpErr.GetCategory()
		details = zhcpErr.GetDetails()
		message = zhcpErr.Error()
	} else {
		category = ErrorCategoryGeneral
		details = map[string]interface{}{
			"original_error_type": fmt.Sprintf("%T", err),
			"original_error":      err.Error(),
		}
		message = fmt.Sprintf("Unexpected error: %s", err.Error())
	}

	// Create error info
	errorInfo := &ErrorInfo{
		ErrorID:   fmt.Sprintf("ERR_%d_%d", time.Now().Unix(), len(eh.errorLog)),
		Category:  category,
		Severity:  eh.determineSeverity(category),
		Message:   message,
		Details:   details,
		Timestamp: time.Now(),
	}

	if documentPath != "" {
		errorInfo.DocumentPath = &documentPath
	}

	if component != "" {
		errorInfo.Component = &component
	}

	// Add suggested action
	action := eh.getSuggestedAction(category)
	if action != "" {
		errorInfo.SuggestedAction = &action
	}

	return errorInfo
}

// logError writes error information to the log file
func (eh *ErrorHandler) logError(errorInfo *ErrorInfo) error {
	logEntry := map[string]interface{}{
		"error_id":      errorInfo.ErrorID,
		"category":      string(errorInfo.Category),
		"severity":      string(errorInfo.Severity),
		"message":       errorInfo.Message,
		"timestamp":     errorInfo.Timestamp.Format(time.RFC3339),
		"document_path": errorInfo.DocumentPath,
		"component":     errorInfo.Component,
		"details":       errorInfo.Details,
	}

	jsonData, err := json.Marshal(logEntry)
	if err != nil {
		return fmt.Errorf("failed to marshal error log entry: %w", err)
	}

	// Open log file for appending
	file, err := os.OpenFile(eh.logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("failed to open error log file: %w", err)
	}
	defer file.Close()

	// Write JSON entry followed by newline
	if _, err := file.WriteString(string(jsonData) + "\n"); err != nil {
		return fmt.Errorf("failed to write error log entry: %w", err)
	}

	return nil
}

// GetErrorSummary returns a summary of recent errors
func (eh *ErrorHandler) GetErrorSummary() map[string]interface{} {
	eh.mutex.RLock()
	defer eh.mutex.RUnlock()

	if len(eh.errorLog) == 0 {
		return map[string]interface{}{
			"total_errors":  0,
			"by_category":   map[string]int{},
			"by_severity":   map[string]int{},
			"recent_errors": []interface{}{},
		}
	}

	byCategory := make(map[string]int)
	bySeverity := make(map[string]int)
	total := len(eh.errorLog)

	for _, errorInfo := range eh.errorLog {
		// Count by category
		cat := string(errorInfo.Category)
		byCategory[cat] = byCategory[cat] + 1

		// Count by severity
		sev := string(errorInfo.Severity)
		bySeverity[sev] = bySeverity[sev] + 1
	}

	// Get recent errors (last 10)
	startIndex := len(eh.errorLog) - 10
	if startIndex < 0 {
		startIndex = 0
	}

	recentErrors := make([]interface{}, 0, 10)
	for i := startIndex; i < len(eh.errorLog); i++ {
		errorInfo := eh.errorLog[i]
		recentErrors = append(recentErrors, map[string]interface{}{
			"error_id":  errorInfo.ErrorID,
			"category":  string(errorInfo.Category),
			"severity":  string(errorInfo.Severity),
			"message":   errorInfo.Message,
			"timestamp": errorInfo.Timestamp.Format(time.RFC3339),
		})
	}

	return map[string]interface{}{
		"total_errors":  total,
		"by_category":   byCategory,
		"by_severity":   bySeverity,
		"recent_errors": recentErrors,
	}
}

// determineSeverity determines severity based on error category
func (eh *ErrorHandler) determineSeverity(category ErrorCategory) ErrorSeverity {
	severityMapping := map[ErrorCategory]ErrorSeverity{
		ErrorCategoryParsing:        ErrorSeverityError,
		ErrorCategoryValidation:     ErrorSeverityWarning,
		ErrorCategoryLLM:            ErrorSeverityError,
		ErrorCategoryTransformation: ErrorSeverityError,
		ErrorCategoryConfiguration:  ErrorSeverityCritical,
		ErrorCategoryNetwork:        ErrorSeverityError,
		ErrorCategoryFile:           ErrorSeverityError,
		ErrorCategoryBusinessLogic:  ErrorSeverityError,
		ErrorCategoryGeneral:        ErrorSeverityError,
	}

	if severity, exists := severityMapping[category]; exists {
		return severity
	}

	return ErrorSeverityError // Default severity
}

// getSuggestedAction gets suggested action based on error category
func (eh *ErrorHandler) getSuggestedAction(category ErrorCategory) string {
	actions := map[ErrorCategory]string{
		ErrorCategoryParsing:        "Check document format and encoding",
		ErrorCategoryValidation:     "Review extracted data structure",
		ErrorCategoryLLM:            "Verify API configuration and credentials",
		ErrorCategoryTransformation: "Check data transformation logic",
		ErrorCategoryConfiguration:  "Review configuration files",
		ErrorCategoryNetwork:        "Check network connectivity",
		ErrorCategoryFile:           "Verify file permissions and existence",
		ErrorCategoryBusinessLogic:  "Review business logic implementation",
	}

	return actions[category]
}

// Create specific error types

// NewParsingError creates a new parsing error
func NewParsingError(message, documentPath string, details map[string]interface{}) *ParsingError {
	if details == nil {
		details = make(map[string]interface{})
	}
	details["document_path"] = documentPath

	baseError := &BaseError{
		Message:   message,
		Category:  ErrorCategoryParsing,
		Details:   details,
		Timestamp: time.Now(),
		ErrorID:   fmt.Sprintf("PARSE_ERR_%d", time.Now().Unix()),
	}

	return &ParsingError{
		BaseError:    baseError,
		DocumentPath: documentPath,
	}
}

// NewValidationError creates a new validation error
func NewValidationError(message, field string, value interface{}) *ValidationError {
	details := map[string]interface{}{
		"field": field,
		"value": value,
	}

	baseError := &BaseError{
		Message:   message,
		Category:  ErrorCategoryValidation,
		Details:   details,
		Timestamp: time.Now(),
		ErrorID:   fmt.Sprintf("VALID_ERR_%d", time.Now().Unix()),
	}

	return &ValidationError{
		BaseError: baseError,
		Field:     field,
		Value:     value,
	}
}

// NewLLMError creates a new LLM error
func NewLLMError(message, provider string, details map[string]interface{}) *LLMError {
	if details == nil {
		details = make(map[string]interface{})
	}
	if provider != "" {
		details["provider"] = provider
	}

	baseError := &BaseError{
		Message:   message,
		Category:  ErrorCategoryLLM,
		Details:   details,
		Timestamp: time.Now(),
		ErrorID:   fmt.Sprintf("LLM_ERR_%d", time.Now().Unix()),
	}

	return &LLMError{
		BaseError: baseError,
		Provider:  provider,
	}
}

// NewTransformationError creates a new transformation error
func NewTransformationError(message string, details map[string]interface{}) *TransformationError {
	if details == nil {
		details = make(map[string]interface{})
	}

	baseError := &BaseError{
		Message:   message,
		Category:  ErrorCategoryTransformation,
		Details:   details,
		Timestamp: time.Now(),
		ErrorID:   fmt.Sprintf("TRANSFORM_ERR_%d", time.Now().Unix()),
	}

	return &TransformationError{
		BaseError: baseError,
	}
}

// NewConfigurationError creates a new configuration error
func NewConfigurationError(message string, details map[string]interface{}) *ConfigurationError {
	if details == nil {
		details = make(map[string]interface{})
	}

	baseError := &BaseError{
		Message:   message,
		Category:  ErrorCategoryConfiguration,
		Details:   details,
		Timestamp: time.Now(),
		ErrorID:   fmt.Sprintf("CONFIG_ERR_%d", time.Now().Unix()),
	}

	return &ConfigurationError{
		BaseError: baseError,
	}
}

// IsErrorType checks if an error is of a specific category
func IsErrorType(err error, category ErrorCategory) bool {
	if zhcpErr, ok := err.(ZhcpError); ok {
		return zhcpErr.GetCategory() == category
	}
	return false
}

// FormatError formats an error for display
func FormatError(err error) string {
	if zhcpErr, ok := err.(ZhcpError); ok {
		return fmt.Sprintf("[%s] %s (ID: %s)",
			strings.ToUpper(string(zhcpErr.GetCategory())),
			zhcpErr.Error(),
			zhcpErr.GetErrorID())
	}
	return err.Error()
}
