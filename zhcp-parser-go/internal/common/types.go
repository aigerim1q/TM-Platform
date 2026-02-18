package common

// ProviderConfig holds configuration for an LLM provider
type ProviderConfig struct {
	Enabled     bool                   `yaml:"enabled" json:"enabled"`
	APIKey      string                 `yaml:"api_key" json:"api_key"`
	Model       string                 `yaml:"model" json:"model"`
	Temperature float64                `yaml:"temperature" json:"temperature"`
	MaxTokens   int                    `yaml:"max_tokens" json:"max_tokens"`
	BaseURL     string                 `yaml:"base_url,omitempty" json:"base_url,omitempty"`
	Details     map[string]interface{} `yaml:",inline" json:",omitempty"`
}

// RetrySettings holds retry configuration
type RetrySettings struct {
	MaxRetries    int     `yaml:"max_retries" json:"max_retries"`
	BackoffFactor float64 `yaml:"backoff_factor" json:"backoff_factor"`
	StatusCodes   []int   `yaml:"status_codes" json:"status_codes"`
}

// RateLimiting holds rate limiting configuration
type RateLimiting struct {
	RequestsPerMinute int `yaml:"requests_per_minute" json:"requests_per_minute"`
	TokensPerMinute   int `yaml:"tokens_per_minute" json:"tokens_per_minute"`
}

// Config represents the configuration for LLM management
type Config struct {
	Providers        map[string]ProviderConfig `yaml:"providers" json:"providers"`
	ProviderPriority []string                  `yaml:"provider_priority" json:"provider_priority"`
	RetrySettings    RetrySettings             `yaml:"retry_settings" json:"retry_settings"`
	RateLimiting     RateLimiting              `yaml:"rate_limiting" json:"rate_limiting"`
	ErrorHandling    ErrorHandlingConfig       `yaml:"error_handling" json:"error_handling"`
}

// ErrorHandlingConfig holds error handling configuration
type ErrorHandlingConfig struct {
	LogFile         string  `yaml:"log_file" json:"log_file"`
	MaxErrors       int     `yaml:"max_errors" json:"max_errors"`
	LogLevel        string  `yaml:"log_level" json:"log_level"`
	ErrorTolerance  float64 `yaml:"error_tolerance" json:"error_tolerance"`
	RecoveryEnabled bool    `yaml:"recovery_enabled" json:"recovery_enabled"`
}
