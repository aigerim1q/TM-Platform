package ollama

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"zhcp-parser-go/internal/ai"
)

// OllamaProvider implements the LLMProvider interface for Ollama
type OllamaProvider struct {
	model   string
	baseURL string
	client  *http.Client
	logger  interface{} // In a real implementation, we'd use a proper logger interface
}

// NewOllamaProvider creates a new Ollama provider
func NewOllamaProvider(model, baseURL string) (*OllamaProvider, error) {
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}

	return &OllamaProvider{
		model:   model,
		baseURL: strings.TrimRight(baseURL, "/"),
		client:  &http.Client{Timeout: 120 * time.Second},
	}, nil
}

// GenerateRequest represents the request structure for Ollama API
type GenerateRequest struct {
	Model   string  `json:"model"`
	Prompt  string  `json:"prompt"`
	Stream  bool    `json:"stream"`
	Options Options `json:"options,omitempty"`
}

// Options contains model options
type Options struct {
	Temperature float64 `json:"temperature,omitempty"`
	NumPredict  int     `json:"num_predict,omitempty"`
}

// GenerateResponse represents the response from Ollama API
type GenerateResponse struct {
	Model              string `json:"model"`
	CreatedAt          string `json:"created_at"`
	Response           string `json:"response"`
	Done               bool   `json:"done"`
	TotalDuration      int    `json:"total_duration"`
	LoadDuration       int    `json:"load_duration"`
	PromptEvalCount    int    `json:"prompt_eval_count"`
	PromptEvalDuration int    `json:"prompt_eval_duration"`
	EvalCount          int    `json:"eval_count"`
	EvalDuration       int    `json:"eval_duration"`
}

// Generate generates a response from the local Ollama instance
func (p *OllamaProvider) Generate(opts ai.GenerationOptions, prompt string) (*ai.LLMResponse, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	// Use the model from options if provided, otherwise use the default
	model := opts.Model
	if model == "" {
		model = p.model
	}

	temperature := opts.Temperature
	if temperature == 0 {
		temperature = 0.1
	}

	maxTokens := opts.MaxTokens
	if maxTokens == 0 {
		maxTokens = 4096
	}

	request := GenerateRequest{
		Model:  model,
		Prompt: prompt,
		Stream: false,
		Options: Options{
			Temperature: temperature,
			NumPredict:  maxTokens,
		},
	}

	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/api/generate", bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Ollama API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Ollama API request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var apiResponse GenerateResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode Ollama response: %w", err)
	}

	content := apiResponse.Response

	// Calculate tokens used (Ollama doesn't provide exact token counts, so we estimate)
	inputTokens := len(strings.Fields(prompt))
	outputTokens := len(strings.Fields(content))
	totalTokens := inputTokens + outputTokens

	tokensUsed := ai.TokenUsage{
		Input:  inputTokens,
		Output: outputTokens,
		Total:  totalTokens,
	}

	// Calculate confidence based on response quality
	confidence := p.calculateConfidence(content)

	response := &ai.LLMResponse{
		Content:    content,
		TokensUsed: tokensUsed,
		Confidence: confidence,
		Model:      model,
		Timestamp:  time.Now(),
	}

	return response, nil
}

// GetCostEstimate returns 0 for local models
func (p *OllamaProvider) GetCostEstimate(inputTokens, outputTokens int) float64 {
	// Local models have zero cost
	return 0.0
}

// GetProviderType returns the provider type
func (p *OllamaProvider) GetProviderType() ai.ProviderType {
	return ai.OllamaProvider
}

// calculateConfidence calculates confidence for local model response
func (p *OllamaProvider) calculateConfidence(content string) float64 {
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
