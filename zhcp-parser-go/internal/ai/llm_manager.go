package ai

import (
	"context"
	"fmt"

	"zhcp-parser-go/internal/common"
)

// LLMManager manages LLM providers with fallback mechanisms
type LLMManager struct {
	config           *common.Config
	providers        map[ProviderType]LLMProvider
	providerPriority []ProviderType
	logger           interface{} // In a real implementation, we'd use a proper logger interface
}

// NewLLMManager creates a new LLM manager
func NewLLMManager(config *common.Config) (*LLMManager, error) {
	manager := &LLMManager{
		config:    config,
		providers: make(map[ProviderType]LLMProvider),
	}

	// Initialize providers
	if err := manager.InitializeProviders(); err != nil {
		return nil, fmt.Errorf("failed to initialize providers: %w", err)
	}

	// Set provider priority
	for _, providerName := range config.ProviderPriority {
		switch providerName {
		case "openai":
			manager.providerPriority = append(manager.providerPriority, OpenAIProvider)
		case "anthropic":
			manager.providerPriority = append(manager.providerPriority, AnthropicProvider)
		case "ollama":
			manager.providerPriority = append(manager.providerPriority, OllamaProvider)
		case "deepseek":
			manager.providerPriority = append(manager.providerPriority, DeepSeekProvider)
		}
	}

	return manager, nil
}

// InitializeProviders initializes configured LLM providers
func (lm *LLMManager) InitializeProviders() error {
	providerConfigs := lm.config.Providers

	// Track initialization errors but continue with other providers
	var initErrors []error

	for providerName, providerConfig := range providerConfigs {
		if providerConfig.Enabled {
			provider, err := CreateProvider(providerName, providerConfig)
			if err != nil {
				// Log the error but continue to initialize other providers
				initErrors = append(initErrors, fmt.Errorf("failed to create provider %s: %w", providerName, err))
				continue
			}

			providerType := getProviderType(providerName)
			lm.providers[providerType] = provider
		}
	}

	// Return error if all providers failed to initialize
	if len(lm.providers) == 0 && len(initErrors) > 0 {
		return fmt.Errorf("failed to initialize any providers: %v", initErrors)
	}

	return nil
}

// getProviderType converts string to ProviderType
func getProviderType(providerName string) ProviderType {
	switch providerName {
	case "openai":
		return OpenAIProvider
	case "anthropic":
		return AnthropicProvider
	case "ollama":
		return OllamaProvider
	case "deepseek":
		return DeepSeekProvider
	default:
		return OpenAIProvider // Default fallback
	}
}

// GenerateWithFallback generates response with fallback to alternative providers
func (lm *LLMManager) GenerateWithFallback(ctx context.Context, opts GenerationOptions, prompt string) (*LLMResponse, error) {
	var lastError error

	for _, providerType := range lm.providerPriority {
		provider, exists := lm.providers[providerType]
		if !exists {
			continue
		}

		// In a real implementation, you'd handle context cancellation
		response, err := provider.Generate(opts, prompt)
		if err != nil {
			lastError = err
			continue
		}

		return response, nil
	}

	if lastError != nil {
		return nil, fmt.Errorf("all providers failed. Last error: %w", lastError)
	}

	return nil, fmt.Errorf("no providers configured or available")
}

// GetProvider returns a specific provider
func (lm *LLMManager) GetProvider(providerType ProviderType) (LLMProvider, bool) {
	provider, exists := lm.providers[providerType]
	return provider, exists
}

// GetAvailableProviders returns a list of available providers
func (lm *LLMManager) GetAvailableProviders() []ProviderType {
	providers := make([]ProviderType, 0, len(lm.providers))
	for providerType := range lm.providers {
		providers = append(providers, providerType)
	}
	return providers
}

// UpdateConfig updates the configuration and reinitializes providers
func (lm *LLMManager) UpdateConfig(config *common.Config) error {
	lm.config = config
	return lm.InitializeProviders()
}
