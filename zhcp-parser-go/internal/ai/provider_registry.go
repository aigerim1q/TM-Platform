package ai

import (
	"fmt"

	"zhcp-parser-go/internal/common"
)

// ProviderConstructor is a function type for creating providers
type ProviderConstructor func(config common.ProviderConfig) (LLMProvider, error)

// providerRegistry holds constructors for different provider types
var providerRegistry = make(map[string]ProviderConstructor)

// RegisterProvider registers a provider constructor
func RegisterProvider(name string, constructor ProviderConstructor) {
	providerRegistry[name] = constructor
}

// CreateProvider creates a provider using the registered constructor
func CreateProvider(name string, config common.ProviderConfig) (LLMProvider, error) {
	constructor, exists := providerRegistry[name]
	if !exists {
		return nil, fmt.Errorf("provider %s not registered", name)
	}
	return constructor(config)
}
