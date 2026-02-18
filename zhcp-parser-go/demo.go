package main

import (
	"fmt"
	"os"

	"zhcp-parser-go/internal/ai"
	"zhcp-parser-go/internal/ai/llm_providers/anthropic"
	"zhcp-parser-go/internal/ai/llm_providers/deepseek"
	"zhcp-parser-go/internal/ai/llm_providers/ollama"
	"zhcp-parser-go/internal/ai/llm_providers/openai"
	"zhcp-parser-go/internal/common"
	"zhcp-parser-go/internal/config"
	"zhcp-parser-go/internal/parser"
	"zhcp-parser-go/internal/parsers/pdf"
)

// Demo function to demonstrate the parser functionality
func main() {
	fmt.Println("=== ЖЦП Parser Demo ===")
	fmt.Println("This demo shows how to use the parser to extract project information from documents.")
	fmt.Println()

	// Check if sample document exists
	sampleDocPath := "testdata/sample_project.pdf"
	if _, err := os.Stat(sampleDocPath); os.IsNotExist(err) {
		fmt.Printf("Sample document not found: %s\n", sampleDocPath)
		fmt.Println("Creating a sample PDF for demonstration...")
		// The sample PDF was already created in the previous step
	}

	// Register all LLM providers to avoid circular imports
	registerProviders()

	// Initialize configuration
	configManager := config.NewConfigManager("configs/llm_config.yaml")
	cfg, err := configManager.LoadConfig()
	if err != nil {
		fmt.Printf("Error loading configuration: %v\n", err)
		return
	}

	// Initialize the parser
	zhcpParser, err := parser.NewZhcpParser(cfg)
	if err != nil {
		fmt.Printf("Error initializing parser: %v\n", err)
		return
	}
	defer zhcpParser.Close()

	// Parse the sample document
	fmt.Printf("Processing: %s\n", sampleDocPath)

	// First, let's test PDF extraction directly
	pdfExtractor := pdf.NewPDFExtractor(nil)
	extractionResult, err := pdfExtractor.ExtractText(sampleDocPath)
	if err != nil {
		fmt.Printf("Error extracting PDF: %v\n", err)
		return
	}
	fmt.Printf("PDF extraction text length: %d\n", len(extractionResult.Text))
	if len(extractionResult.Text) > 0 {
		fmt.Printf("First 200 chars of extracted text: %.200s\n", extractionResult.Text)
	} else {
		fmt.Println("No text extracted from PDF")
	}

	result, err := zhcpParser.ParseDocument(sampleDocPath, true, true)
	if err != nil {
		fmt.Printf("Error parsing document: %v\n", err)
		return
	}

	// Display results
	if result.Success {
		fmt.Println("✅ Parsing successful!")
		fmt.Printf("Confidence: %.2f\n", result.ExtractionMetadata.Confidence)
		fmt.Printf("Processing time: %.2f seconds\n", result.ExtractionMetadata.ProcessingTime)

		if result.ProjectStructure != nil {
			project := result.ProjectStructure.Project
			fmt.Printf("Project Title: %s\n", project.Title)
			fmt.Printf("Description: %s\n", truncateString(project.Description, 100))
			fmt.Printf("Phases: %d\n", len(project.Phases))

			totalTasks := 0
			for _, phase := range project.Phases {
				totalTasks += len(phase.Tasks)
			}
			fmt.Printf("Total Tasks: %d\n", totalTasks)

			// Show first phase and task as example
			if len(project.Phases) > 0 {
				firstPhase := project.Phases[0]
				fmt.Printf("First phase: %s\n", firstPhase.Name)

				if len(firstPhase.Tasks) > 0 {
					firstTask := firstPhase.Tasks[0]
					fmt.Printf("First task: %s\n", firstTask.Name)
				}
			}
		}
	} else {
		fmt.Println("❌ Parsing failed!")
		if result.Error != nil {
			fmt.Printf("Error: %s\n", result.Error.Message)
			fmt.Printf("Category: %s\n", result.Error.Category)
		}
		if result.ValidationError != nil {
			fmt.Printf("Validation errors: %v\n", result.ValidationError)
		}
	}

	fmt.Println()
	fmt.Println("=== Demo Complete ===")
}

// registerProviders registers all LLM providers
func registerProviders() {
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

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
