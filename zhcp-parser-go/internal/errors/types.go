package errors

import "time"

// ErrorCategory represents the category of an error
type ErrorCategory string

const (
	ErrorCategoryParsing        ErrorCategory = "parsing_error"
	ErrorCategoryValidation     ErrorCategory = "validation_error"
	ErrorCategoryLLM            ErrorCategory = "llm_error"
	ErrorCategoryTransformation ErrorCategory = "transformation_error"
	ErrorCategoryConfiguration  ErrorCategory = "configuration_error"
	ErrorCategoryNetwork        ErrorCategory = "network_error"
	ErrorCategoryFile           ErrorCategory = "file_error"
	ErrorCategoryBusinessLogic  ErrorCategory = "business_logic_error"
	ErrorCategoryGeneral        ErrorCategory = "error"
)

// ErrorSeverity represents the severity of an error
type ErrorSeverity string

const (
	ErrorSeverityInfo     ErrorSeverity = "info"
	ErrorSeverityWarning  ErrorSeverity = "warning"
	ErrorSeverityError    ErrorSeverity = "error"
	ErrorSeverityCritical ErrorSeverity = "critical"
)

// ErrorInfo represents comprehensive error information
type ErrorInfo struct {
	ErrorID         string                 `json:"error_id"`
	Category        ErrorCategory          `json:"category"`
	Severity        ErrorSeverity          `json:"severity"`
	Message         string                 `json:"message"`
	Details         map[string]interface{} `json:"details"`
	Timestamp       time.Time              `json:"timestamp"`
	DocumentPath    *string                `json:"document_path,omitempty"`
	Component       *string                `json:"component,omitempty"`
	Traceback       *string                `json:"traceback,omitempty"`
	SuggestedAction *string                `json:"suggested_action,omitempty"`
}

// ZhcpError is the interface for ЖЦП errors
type ZhcpError interface {
	Error() string
	GetCategory() ErrorCategory
	GetDetails() map[string]interface{}
	GetTimestamp() time.Time
	GetErrorID() string
}

// BaseError implements the base error functionality
type BaseError struct {
	Message   string
	Category  ErrorCategory
	Details   map[string]interface{}
	Timestamp time.Time
	ErrorID   string
}

// Error returns the error message
func (e *BaseError) Error() string {
	return e.Message
}

// GetCategory returns the error category
func (e *BaseError) GetCategory() ErrorCategory {
	return e.Category
}

// GetDetails returns the error details
func (e *BaseError) GetDetails() map[string]interface{} {
	return e.Details
}

// GetTimestamp returns the error timestamp
func (e *BaseError) GetTimestamp() time.Time {
	return e.Timestamp
}

// GetErrorID returns the error ID
func (e *BaseError) GetErrorID() string {
	return e.ErrorID
}

// ParsingError represents a parsing error
type ParsingError struct {
	*BaseError
	DocumentPath string
}

// ValidationError represents a validation error
type ValidationError struct {
	*BaseError
	Field string
	Value interface{}
}

// LLMError represents an LLM error
type LLMError struct {
	*BaseError
	Provider string
}

// TransformationError represents a transformation error
type TransformationError struct {
	*BaseError
}

// ConfigurationError represents a configuration error
type ConfigurationError struct {
	*BaseError
}
