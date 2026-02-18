package parser

import (
	"zhcp-parser-go/internal/common"
)

// Config holds the configuration for the parser
type Config struct {
	Providers        map[string]common.ProviderConfig `yaml:"providers" json:"providers"`
	ProviderPriority []string                         `yaml:"provider_priority" json:"provider_priority"`
	RetrySettings    common.RetrySettings             `yaml:"retry_settings" json:"retry_settings"`
	RateLimiting     common.RateLimiting              `yaml:"rate_limiting" json:"rate_limiting"`
	ErrorHandling    ErrorHandlingConfig              `yaml:"error_handling" json:"error_handling"`
}

// ErrorHandlingConfig holds error handling configuration
type ErrorHandlingConfig struct {
	LogFile         string  `yaml:"log_file" json:"log_file"`
	MaxErrors       int     `yaml:"max_errors" json:"max_errors"`
	LogLevel        string  `yaml:"log_level" json:"log_level"`
	ErrorTolerance  float64 `yaml:"error_tolerance" json:"error_tolerance"`
	RecoveryEnabled bool    `yaml:"recovery_enabled" json:"recovery_enabled"`
}
