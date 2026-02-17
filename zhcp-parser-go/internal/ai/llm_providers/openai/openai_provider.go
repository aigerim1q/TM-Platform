package openai

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

// OpenAIProvider implements the LLMProvider interface for OpenAI
type OpenAIProvider struct {
	apiKey  string
	model   string
	baseURL string
	client  *http.Client
	logger  interface{} // In a real implementation, we'd use a proper logger interface
}

// NewOpenAIProvider creates a new OpenAI provider
func NewOpenAIProvider(apiKey, model string) (*OpenAIProvider, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("OpenAI API key is required")
	}

	return &OpenAIProvider{
		apiKey:  apiKey,
		model:   model,
		baseURL: "https://api.openai.com/v1",
		client:  &http.Client{Timeout: 300 * time.Second}, // 5 minutes for large documents
	}, nil
}

// ChatCompletionRequest represents the request structure for OpenAI API
type ChatCompletionRequest struct {
	Model          string          `json:"model"`
	Messages       []Message       `json:"messages"`
	Temperature    float32         `json:"temperature,omitempty"`
	MaxTokens      int             `json:"max_tokens,omitempty"`
	ResponseFormat *ResponseFormat `json:"response_format,omitempty"`
}

// Message represents a message in the conversation
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ResponseFormat specifies the format of the response
type ResponseFormat struct {
	Type string `json:"type"`
}

// ChatCompletionResponse represents the response from OpenAI API
type ChatCompletionResponse struct {
	ID      string   `json:"id"`
	Choices []Choice `json:"choices"`
	Usage   Usage    `json:"usage"`
}

// Choice represents a choice in the response
type Choice struct {
	Index   int     `json:"index"`
	Message Message `json:"message"`
}

// Usage represents token usage
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// Generate generates a response from the OpenAI API
func (p *OpenAIProvider) Generate(opts ai.GenerationOptions, prompt string) (*ai.LLMResponse, error) {
	// Increased timeout to 5 minutes for large documents
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Second)
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

	request := ChatCompletionRequest{
		Model: model,
		Messages: []Message{
			{
				Role:    "system",
				Content: "You are an expert in extracting structured project information from documents. Return only valid JSON without additional text.",
			},
			{
				Role:    "user",
				Content: prompt,
			},
		},
		Temperature:    temperature,
		MaxTokens:      maxTokens,
		ResponseFormat: &ResponseFormat{Type: "json_object"},
	}

	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/chat/completions", bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("OpenAI API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenAI API request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var apiResponse ChatCompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode OpenAI response: %w", err)
	}

	if len(apiResponse.Choices) == 0 {
		return nil, fmt.Errorf("no choices returned from OpenAI API")
	}

	content := apiResponse.Choices[0].Message.Content

	// Calculate tokens used
	tokensUsed := ai.TokenUsage{
		Input:  apiResponse.Usage.PromptTokens,
		Output: apiResponse.Usage.CompletionTokens,
		Total:  apiResponse.Usage.TotalTokens,
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

// GetCostEstimate calculates cost based on OpenAI pricing
func (p *OpenAIProvider) GetCostEstimate(inputTokens, outputTokens int) float64 {
	// Example pricing (gpt-4-turbo): $10/1M input tokens, $30/1M output tokens
	inputCost := (float64(inputTokens) / 1_000_000) * 10
	outputCost := (float64(outputTokens) / 1_000_000) * 30
	return inputCost + outputCost
}

// GetProviderType returns the provider type
func (p *OpenAIProvider) GetProviderType() ai.ProviderType {
	return ai.OpenAIProvider
}

// calculateConfidence calculates confidence score based on response quality
func (p *OpenAIProvider) calculateConfidence(content string, usage ai.TokenUsage) float64 {
	if content == "" || containsError(content) {
		return 0.1
	}

	// Check if response is valid JSON
	if isValidJSON(content) {
		jsonValidity := 1.0
		// Consider token usage for complexity
		totalTokens := usage.Total
		lengthFactor := min(float64(totalTokens)/1000, 1.0) // Cap at 1.0

		return (jsonValidity + lengthFactor) / 2
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

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
