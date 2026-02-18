package config

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"zhcp-parser-go/internal/common"

	"gopkg.in/yaml.v3"
)

// ConfigManager handles configuration loading and management
type ConfigManager struct {
	configPath string
	config     *common.Config
	logger     interface{}  // In a real implementation, we'd use a proper logger interface
	mutex      sync.RWMutex // For thread safety
}

// NewConfigManager creates a new configuration manager
func NewConfigManager(configPath string) *ConfigManager {
	return &ConfigManager{
		configPath: configPath,
		config:     nil,
	}
}

// LoadConfig loads the configuration from the specified file
func (cm *ConfigManager) LoadConfig() (*common.Config, error) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()

	// Check if config file exists
	if _, err := os.Stat(cm.configPath); os.IsNotExist(err) {
		// If config doesn't exist, create default config
		defaultConfig := cm.getDefaultConfig()
		if err := cm.saveConfig(defaultConfig); err != nil {
			return nil, fmt.Errorf("failed to create default config: %w", err)
		}
		cm.config = defaultConfig
		return defaultConfig, nil
	}

	// Read the config file
	configData, err := os.ReadFile(cm.configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// Substitute environment variables
	configData = cm.substituteEnvVars(configData)

	// Unmarshal the YAML
	var config common.Config
	if err := yaml.Unmarshal(configData, &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Validate the configuration
	if err := cm.validateConfig(&config); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	cm.config = &config
	return &config, nil
}

// SaveConfig saves the configuration to the file
func (cm *ConfigManager) SaveConfig(config *common.Config) error {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()

	return cm.saveConfig(config)
}

// saveConfig saves the configuration to the file (internal method)
func (cm *ConfigManager) saveConfig(config *common.Config) error {
	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Ensure the directory exists
	configDir := filepath.Dir(cm.configPath)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	if err := os.WriteFile(cm.configPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// GetConfig returns the loaded configuration
func (cm *ConfigManager) GetConfig() *common.Config {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	return cm.config
}

// UpdateConfig updates the configuration
func (cm *ConfigManager) UpdateConfig(config *common.Config) error {
	if err := cm.validateConfig(config); err != nil {
		return fmt.Errorf("config validation failed: %w", err)
	}

	if err := cm.saveConfig(config); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	cm.mutex.Lock()
	cm.config = config
	cm.mutex.Unlock()

	return nil
}

// validateConfig validates the configuration
func (cm *ConfigManager) validateConfig(config *common.Config) error {
	// Validate provider configurations
	for providerName, providerConfig := range config.Providers {
		if providerConfig.Enabled {
			// Validate required fields based on provider
			if providerConfig.APIKey == "" && providerName != "ollama" {
				return fmt.Errorf("provider %s is enabled but API key is not set", providerName)
			}
			if providerConfig.Model == "" {
				return fmt.Errorf("provider %s is enabled but model is not set", providerName)
			}
		}
	}

	// Validate provider priority list references existing providers
	for _, providerName := range config.ProviderPriority {
		if _, exists := config.Providers[providerName]; !exists {
			return fmt.Errorf("provider priority list references non-existent provider: %s", providerName)
		}
	}

	// Validate rate limiting values
	if config.RateLimiting.RequestsPerMinute <= 0 {
		return fmt.Errorf("requests per minute must be positive")
	}
	if config.RateLimiting.TokensPerMinute <= 0 {
		return fmt.Errorf("tokens per minute must be positive")
	}

	return nil
}

// substituteEnvVars substitutes environment variables in the config data
func (cm *ConfigManager) substituteEnvVars(configData []byte) []byte {
	// Pattern to match ${VAR_NAME} or ${VAR_NAME:default_value}
	re := regexp.MustCompile(`\$\{([^}]+)\}`)

	return re.ReplaceAllFunc(configData, func(match []byte) []byte {
		// Extract the variable name and default value
		varName := string(match[2 : len(match)-1]) // Remove ${ and }

		// Check if there's a default value (separated by colon)
		parts := strings.SplitN(varName, ":", 2)
		envVar := parts[0]
		defaultValue := ""
		if len(parts) > 1 {
			defaultValue = parts[1]
		}

		// Get the environment variable value
		value := os.Getenv(envVar)
		if value == "" {
			value = defaultValue
		}

		return []byte(value)
	})
}

// getDefaultConfig returns the default configuration
func (cm *ConfigManager) getDefaultConfig() *common.Config {
	return &common.Config{
		Providers: map[string]common.ProviderConfig{
			"ollama": {
				Enabled:     true,
				Model:       "llama3",
				BaseURL:     "http://localhost:11434",
				Temperature: 0.1,
				MaxTokens:   4096,
			},
			"openai": {
				Enabled:     false,
				APIKey:      "${OPENAI_API_KEY}",
				Model:       "gpt-4-turbo",
				Temperature: 0.1,
				MaxTokens:   4096,
			},
			"anthropic": {
				Enabled:     false,
				APIKey:      "${ANTHROPIC_API_KEY}",
				Model:       "claude-3-sonnet-20240229",
				Temperature: 0.1,
				MaxTokens:   4096,
			},
			"deepseek": {
				Enabled:     false,
				APIKey:      "${DEEPSEEK_API_KEY}",
				Model:       "deepseek-chat",
				Temperature: 0.1,
				MaxTokens:   4096,
			},
		},
		ProviderPriority: []string{"ollama", "openai", "anthropic", "deepseek"},
		RetrySettings: common.RetrySettings{
			MaxRetries:    3,
			BackoffFactor: 1.0,
			StatusCodes:   []int{429, 502, 503, 504},
		},
		RateLimiting: common.RateLimiting{
			RequestsPerMinute: 60,
			TokensPerMinute:   100000,
		},
		ErrorHandling: common.ErrorHandlingConfig{
			LogFile:         "logs/errors.log",
			MaxErrors:       1000,
			LogLevel:        "INFO",
			ErrorTolerance:  0.1,
			RecoveryEnabled: true,
		},
	}
}

// IsProviderEnabled checks if a provider is enabled
func (cm *ConfigManager) IsProviderEnabled(providerName string) bool {
	config := cm.GetConfig()
	if config == nil {
		return false
	}

	provider, exists := config.Providers[providerName]
	if !exists {
		return false
	}

	return provider.Enabled
}

// GetProviderConfig returns the configuration for a specific provider
func (cm *ConfigManager) GetProviderConfig(providerName string) (*common.ProviderConfig, bool) {
	config := cm.GetConfig()
	if config == nil {
		return nil, false
	}

	provider, exists := config.Providers[providerName]
	if !exists {
		return nil, false
	}

	return &provider, true
}

// GetEnabledProviders returns a list of enabled providers
func (cm *ConfigManager) GetEnabledProviders() []string {
	config := cm.GetConfig()
	if config == nil {
		return nil
	}

	var enabledProviders []string
	for name, provider := range config.Providers {
		if provider.Enabled {
			enabledProviders = append(enabledProviders, name)
		}
	}

	return enabledProviders
}
