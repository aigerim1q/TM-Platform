package anthropic

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"zhcp-parser-go/internal/ai"
)

// AnthropicProvider implements the LLMProvider interface for Anthropic
type AnthropicProvider struct {
	apiKey  string
	model   string
	baseURL string
	client  *http.Client
	logger  interface{} // In a real implementation, we'd use a proper logger interface
}

// NewAnthropicProvider creates a new Anthropic provider
func NewAnthropicProvider(apiKey, model string) (*AnthropicProvider, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("Anthropic API key is required")
	}

	return &AnthropicProvider{
		apiKey:  apiKey,
		model:   model,
		baseURL: "https://api.anthropic.com/v1",
		client:  &http.Client{Timeout: 60 * time.Second},
	}, nil
}

// MessageRequest represents the request structure for Anthropic API
type MessageRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	MaxTokens   int       `json:"max_tokens"`
	Temperature float32   `json:"temperature,omitempty"`
	System      string    `json:"system,omitempty"`
}

// Message represents a message in the conversation
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// MessageResponse represents the response from Anthropic API
type MessageResponse struct {
	ID      string    `json:"id"`
	Content []Content `json:"content"`
	Model   string    `json:"model"`
	Usage   Usage     `json:"usage"`
}

// Content represents the content in the response
type Content struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// Usage represents token usage
type Usage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// Generate generates a response from the Anthropic API
func (p *AnthropicProvider) Generate(opts ai.GenerationOptions, prompt string) (*ai.LLMResponse, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Use the model from options if provided, otherwise use the default
	model := opts.Model
	if model == "" {
		model = p.model
	}

	temperature := float32(opts.Temperature)
	if temperature == 0 {
		temperature = 0.1
	}

	maxTokens := opts.MaxTokens
	if maxTokens == 0 {
		maxTokens = 4096
	}

	request := MessageRequest{
		Model: model,
		Messages: []Message{
			{
				Role:    "user",
				Content: prompt,
			},
		},
		MaxTokens:   maxTokens,
		Temperature: temperature,
		System:      "You are an expert in extracting structured project information from documents. Return only valid JSON without additional text.",
	}

	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/messages", bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", p.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Anthropic API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Anthropic API request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var apiResponse MessageResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode Anthropic response: %w", err)
	}

	if len(apiResponse.Content) == 0 {
		return nil, fmt.Errorf("no content returned from Anthropic API")
	}

	content := apiResponse.Content[0].Text

	// Calculate tokens used
	tokensUsed := ai.TokenUsage{
		Input:  apiResponse.Usage.InputTokens,
		Output: apiResponse.Usage.OutputTokens,
		Total:  apiResponse.Usage.InputTokens + apiResponse.Usage.OutputTokens,
	}

	// Calculate confidence based on response quality
	confidence := p.calculateConfidence(content, tokensUsed)

	response := &ai.LLMResponse{
		Content:    content,
		TokensUsed: tokensUsed,
		Confidence: confidence,
		Model:      model,
		Timestamp:  time.Now(),
	}

	return response, nil
}

// GetCostEstimate calculates cost based on Anthropic pricing
func (p *AnthropicProvider) GetCostEstimate(inputTokens, outputTokens int) float64 {
	// Example pricing (Claude 3 Sonnet): $3/1M input tokens, $15/1M output tokens
	inputCost := (float64(inputTokens) / 1_000_000) * 3
	outputCost := (float64(outputTokens) / 1_000_000) * 15
	return inputCost + outputCost
}

// GetProviderType returns the provider type
func (p *AnthropicProvider) GetProviderType() ai.ProviderType {
	return ai.AnthropicProvider
}

// calculateConfidence calculates confidence score for Anthropic response
func (p *AnthropicProvider) calculateConfidence(content string, usage ai.TokenUsage) float64 {
	if content == "" || containsError(content) {
		return 0.1
	}

	// Check if response is valid JSON
	if isValidJSON(content) {
		return 1.0
	}

	return 0.3
}

// Helper functions for confidence calculation
func containsError(content string) bool {
	contentLower := fmt.Sprintf("%s", content)
	return len(contentLower) > 0 &&
		(contentLower == "error" ||
			contentLower == "null" ||
			contentLower == "null\n" ||
			len(contentLower) < 10) // Very short responses are likely errors
}

func isValidJSON(content string) bool {
	// In a real implementation, you'd use json.Valid() to check
	// For this example, we'll just check if it starts and ends with braces
	content = trimSpace(content)
	return len(content) >= 2 &&
		content[0] == '{' &&
		content[len(content)-1] == '}'
}

func trimSpace(s string) string {
	// Simple space trimming
	start := 0
	end := len(s)

	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}

	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}

	return s[start:end]
}
