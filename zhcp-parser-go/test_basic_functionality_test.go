package main

import (
	"os"
	"testing"

	"zhcp-parser-go/internal/ai"
	"zhcp-parser-go/internal/ai/llm_providers/anthropic"
	"zhcp-parser-go/internal/ai/llm_providers/deepseek"
	"zhcp-parser-go/internal/ai/llm_providers/ollama"
	"zhcp-parser-go/internal/ai/llm_providers/openai"
	"zhcp-parser-go/internal/common"
	"zhcp-parser-go/internal/config"
	"zhcp-parser-go/internal/parser"
)

func registerTestProviders() {
	ai.RegisterProvider("openai", func(config common.ProviderConfig) (ai.LLMProvider, error) {
		return openai.NewOpenAIProvider(config.APIKey, config.Model)
	})
	ai.RegisterProvider("anthropic", func(config common.ProviderConfig) (ai.LLMProvider, error) {
		return anthropic.NewAnthropicProvider(config.APIKey, config.Model)
	})
	ai.RegisterProvider("ollama", func(config common.ProviderConfig) (ai.LLMProvider, error) {
		return ollama.NewOllamaProvider(config.Model, config.BaseURL)
	})
	ai.RegisterProvider("deepseek", func(config common.ProviderConfig) (ai.LLMProvider, error) {
		return deepseek.NewDeepSeekProvider(config.APIKey, config.Model)
	})
}

// TestBasicFunctionality tests the basic functionality of the parser
func TestBasicFunctionality(t *testing.T) {
	registerTestProviders()
	// Create a temporary config file for testing
	tempConfigPath := "test_config.yaml"

	// Initialize configuration
	configManager := config.NewConfigManager(tempConfigPath)
	cfg, err := configManager.LoadConfig()
	if err != nil {
		t.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize the parser
	zhcpParser, err := parser.NewZhcpParser(cfg)
	if err != nil {
		t.Fatalf("Failed to initialize parser: %v", err)
	}
	defer zhcpParser.Close()

	// Test that the parser was created successfully
	if zhcpParser == nil {
		t.Fatal("Parser should not be nil")
	}

	// Test configuration loading
	if cfg == nil {
		t.Error("Configuration should not be nil")
	}

	// Test that providers are properly configured (at least default ones)
	enabledProviders := configManager.GetEnabledProviders()
	if len(enabledProviders) == 0 {
		t.Log("No providers enabled - this may be expected depending on configuration")
	} else {
		t.Logf("Found %d enabled providers: %v", len(enabledProviders), enabledProviders)
	}
}

// TestConfigLoading tests configuration loading functionality
func TestConfigLoading(t *testing.T) {
	// Create a temporary config file for testing
	tempConfigPath := "test_config_loading.yaml"

	// Initialize configuration
	configManager := config.NewConfigManager(tempConfigPath)
	cfg, err := configManager.LoadConfig()
	if err != nil {
		t.Fatalf("Failed to load configuration: %v", err)
	}

	// Verify default configuration values
	if cfg == nil {
		t.Fatal("Configuration should not be nil")
	}

	// Check that default providers are present
	if cfg.Providers == nil {
		t.Fatal("Providers configuration should not be nil")
	}

	// Check for expected providers
	expectedProviders := []string{"ollama", "openai", "anthropic", "deepseek"}
	for _, expectedProvider := range expectedProviders {
		if _, exists := cfg.Providers[expectedProvider]; !exists {
			t.Errorf("Expected provider %s not found in configuration", expectedProvider)
		}
	}

	// Verify default provider priority
	if len(cfg.ProviderPriority) == 0 {
		t.Error("Provider priority list should not be empty")
	}
}

// TestConfigUpdate tests updating configuration
func TestConfigUpdate(t *testing.T) {
	// Create a temporary config file for testing
	tempConfigPath := "test_config_update.yaml"

	// Initialize configuration
	configManager := config.NewConfigManager(tempConfigPath)
	cfg, err := configManager.LoadConfig()
	if err != nil {
		t.Fatalf("Failed to load configuration: %v", err)
	}

	// Modify configuration
	updatedConfig := *cfg
	updatedConfig.ErrorHandling.LogLevel = "DEBUG"

	// Update configuration
	err = configManager.UpdateConfig(&updatedConfig)
	if err != nil {
		t.Fatalf("Failed to update configuration: %v", err)
	}

	// Verify update
	updatedCfg := configManager.GetConfig()
	if updatedCfg.ErrorHandling.LogLevel != "DEBUG" {
		t.Errorf("Expected LogLevel to be DEBUG, got %s", updatedCfg.ErrorHandling.LogLevel)
	}
}

// Cleanup function to remove test config files
func tearDownTestConfigFiles() {
	files := []string{"test_config.yaml", "test_config_loading.yaml", "test_config_update.yaml"}
	for _, file := range files {
		os.Remove(file)
	}
}

// TestMain runs before and after all tests
func TestMain(m *testing.M) {
	// Setup
	// (In a real implementation, you might set up test fixtures here)

	// Run tests
	exitCode := m.Run()

	// Teardown
	tearDownTestConfigFiles()

	// Exit with the same code as the tests
	os.Exit(exitCode)
}
