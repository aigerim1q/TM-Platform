package ai

import "time"

// ProviderType represents the type of LLM provider
type ProviderType string

const (
	OpenAIProvider    ProviderType = "openai"
	AnthropicProvider ProviderType = "anthropic"
	OllamaProvider    ProviderType = "ollama"
	DeepSeekProvider  ProviderType = "deepseek"
)

// GenerationOptions contains options for LLM generation
type GenerationOptions struct {
	Temperature float64 `json:"temperature"`
	MaxTokens   int     `json:"max_tokens"`
	Model       string  `json:"model"`
}

// LLMResponse represents the response from an LLM
type LLMResponse struct {
	Content    string      `json:"content"`
	TokensUsed TokenUsage  `json:"tokens_used"`
	Confidence float64     `json:"confidence"`
	Model      string      `json:"model"`
	Timestamp  time.Time   `json:"timestamp"`
	ParsedData interface{} `json:"parsed_data,omitempty"` // Will be set after JSON parsing
}

// TokenUsage represents token usage information
type TokenUsage struct {
	Input  int `json:"input"`
	Output int `json:"output"`
	Total  int `json:"total"`
}

// LLMProvider is the interface for LLM providers
type LLMProvider interface {
	Generate(opts GenerationOptions, prompt string) (*LLMResponse, error)
	GetCostEstimate(inputTokens, outputTokens int) float64
	GetProviderType() ProviderType
}
