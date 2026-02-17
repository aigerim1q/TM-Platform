# ЖЦП Parser - AI-Powered Project Lifecycle Document Parser (Go Version)

An AI-powered module that automatically extracts project structure information from PDF and DOCX documents (ЖЦП - Жизненный Цикл Проекта / Project Lifecycle Documents).

## Overview

The ЖЦП Parser is designed to automatically extract structured project information from unstructured Project Lifecycle Documents, including:

- Project phases
- Tasks within each phase
- Timeline information (start/end dates)
- Responsible persons and their roles
- Task dependencies and relationships

This is the **Go version** of the original Python implementation, providing improved performance, better concurrency handling, and enhanced stability.

## Features

- **Multi-format Support**: PDF and DOCX document parsing
- **AI-Powered Extraction**: Uses LLMs to extract structured data
- **Intelligent Task Assignment**: Automatically assigns responsible persons to tasks based on content analysis
- **Employee Pool Management**: Pre-configured team members with different roles and specializations
- **Fallback Mechanisms**: Supports multiple LLM providers (OpenAI, Anthropic, Ollama)
- **Data Validation**: Comprehensive validation and quality assurance
- **Error Handling**: Robust error handling and recovery
- **Configurable**: Flexible configuration for different use cases
- **Automatic File Output**: Results automatically saved to Desktop or Downloads folder when no output file is specified
- **High Performance**: Optimized for speed and efficiency

## Prerequisites

- Go 1.21 or higher
- Go modules support

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd zhcp-parser-go
```

2. Initialize Go modules (if not already done):

```bash
go mod init zhcp-parser-go
go mod tidy
```

## Configuration

### LLM Providers

The system supports multiple LLM providers:

1. **OpenAI** (GPT-4, GPT-4 Turbo)
2. **Anthropic** (Claude models)
3. **Ollama** (Local models like Llama 3)
4. **DeepSeek** (Open-source models)

Configure your preferred providers in `configs/llm_config.yaml`:

```yaml
providers:
  openai:
    enabled: false
    api_key: "${OPENAI_API_KEY}" # Use environment variable
    model: "gpt-4-turbo"
    temperature: 0.1
    max_tokens: 4096

  anthropic:
    enabled: false
    api_key: "${ANTHROPIC_API_KEY}" # Use environment variable
    model: "claude-3-sonnet-20240229"
    temperature: 0.1
    max_tokens: 4096

  ollama:
    enabled: true # Default to local model
    model: "llama3"
    base_url: "http://localhost:11434"
    temperature: 0.1
    max_tokens: 4096

  deepseek:
    enabled: false
    api_key: "${DEEPSEEK_API_KEY}"
    model: "deepseek-chat"
    temperature: 0.1
    max_tokens: 4096

provider_priority:
  - "ollama" # Primary provider
  - "openai" # Fallback 1
  - "anthropic" # Fallback 2
```

### Environment Variables

For security, store API keys as environment variables:

```bash
export OPENAI_API_KEY="your-openai-api-key"
export ANTHROPIC_API_KEY="your-anthropic-api-key"
export DEEPSEEK_API_KEY="your-deepseek-api-key"
```

## Usage

### Command Line Interface

The parser provides a command-line interface for easy usage:

```bash
# Basic usage - parse a document (results automatically saved to Desktop/Downloads)
go run cmd/zhcp-parser/main.go parse path/to/your/document.pdf

# With options
go run cmd/zhcp-parser/main.go parse path/to/your/document.pdf --validate --enrich --output output.json

# Parse DOCX document (results automatically saved to Desktop/Downloads if no output specified)
go run cmd/zhcp-parser/main.go parse path/to/your/document.docx

# Batch processing
go run cmd/zhcp-parser/main.go batch path/to/directory/
```

### Library Usage

You can also use the parser as a library in your Go applications:

```go
package main

import (
    "fmt"
    "zhcp-parser-go/internal/config"
    "zhcp-parser-go/internal/parser"
)

func main() {
    // Initialize configuration
    configManager := config.NewConfigManager("configs/llm_config.yaml")
    cfg, err := configManager.LoadConfig()
    if err != nil {
        panic(err)
    }

    // Initialize the parser
    parser, err := parser.NewZhcpParser(cfg)
    if err != nil {
        panic(err)
    }
    defer parser.Close()

    // Parse a document
    result, err := parser.ParseDocument("path/to/your/document.pdf", true, true)
    if err != nil {
        panic(err)
    }

    // Check if parsing was successful
    if result.Success {
        projectStructure := result.ProjectStructure
        fmt.Printf("Project title: %s\n", projectStructure.Project.Title)
        fmt.Printf("Number of phases: %d\n", len(projectStructure.Project.Phases))
    } else {
        fmt.Printf("Parsing failed: %v\n", result.Error.Message)
    }
}
```

## API Reference

### ZhcpParser Class

#### Constructor

```go
parser, err := parser.NewZhcpParser(config)
```

**Parameters:**

- `config` (Config): Configuration object. If nil, uses default configuration

#### Methods

##### `ParseDocument(documentPath string, validate bool, enrich bool)`

Parses a document and extracts project structure.

**Parameters:**

- `documentPath` (string): Path to the PDF or DOCX document
- `validate` (bool): Whether to perform validation. Default is true
- `enrich` (bool): Whether to enrich data with computed fields. Default is true

**Returns:**

```go
struct {
    Success           bool
    ProjectStructure  *ProjectStructure
    ExtractionMetadata ExtractionMetadata
    ValidationError   []string
    ProcessingNotes   []string
    Error             *ErrorInfo
}
```

## Project Structure

```
zhcp-parser-go/
├── cmd/
│   └── zhcp-parser/
│       └── main.go                 # Command-line interface
├── internal/
│   ├── parser/
│   │   ├── parser.go              # Main entry point
│   │   └── types.go               # Parser types
│   │   └── config.go              # Parser configuration
│   ├── parsers/
│   │   ├── pdf/
│   │   │   ├── pdf_parser.go      # PDF extraction
│   │   │   ├── pdf_validator.go   # PDF validation
│   │   │   └── types.go           # PDF types
│   │   ├── docx/
│   │   │   ├── docx_parser.go     # DOCX extraction
│   │   │   ├── docx_validator.go  # DOCX validation
│   │   │   └── types.go           # DOCX types
│   │   └── text_preprocessor.go   # Text preprocessing
│   ├── ai/
│   │   ├── llm_manager.go         # LLM integration
│   │   ├── shared_types.go        # Shared types
│   │   ├── types.go               # AI types
│   │   ├── llm_providers/
│   │   │   ├── openai/
│   │   │   │   └── openai_provider.go
│   │   │   ├── anthropic/
│   │   │   │   └── anthropic_provider.go
│   │   │   ├── ollama/
│   │   │   │   └── ollama_provider.go
│   │   │   └── deepseek/
│   │   │       └── deepseek_provider.go
│   │   └── prompt_engineering/    # Prompt management
│   │       ├── types.go
│   │       └── prompt_manager.go
│   ├── transformers/
│   │   ├── types.go               # Transformer types
│   │   ├── json_transformer.go    # Data transformation
│   │   └── data_enricher.go       # Data enrichment
│   ├── validators/
│   │   ├── types.go               # Validator types
│   │   ├── document_validator.go  # Document validation
│   │   ├── structure_validator.go # Structure validation
│   │   ├── consistency_validator.go # Consistency validation
│   │   └── validation_pipeline.go # Validation pipeline
│   ├── config/
│   │   └── config.go              # Configuration management
│   ├── errors/
│   │   ├── types.go               # Error types
│   │   └── error_handler.go       # Error handling system
│   └── utils/
│       └── helpers.go             # Utility functions
├── configs/
│   └── llm_config.yaml            # Configuration
├── docs/
│   └── api_spec.md                # API specification
├── testdata/
│   └── sample_project.pdf         # Sample documents
├── go.mod                         # Dependencies
├── README.md                      # This file
├── demo.go                        # Demo application
└── plans/                         # Implementation plans
    └── *.md
```

## Dependencies

- `github.com/pdfcpu/pdfcpu` - For PDF document parsing
- `github.com/baliance/gooxml` - For DOCX document parsing
- `github.com/sashabaranov/go-openai/v2` - For OpenAI API integration
- `github.com/anthropics/anthropic-sdk-go` - For Anthropic API integration
- `github.com/go-playground/validator/v10` - For data validation
- `github.com/spf13/cobra` - For CLI commands
- `gopkg.in/yaml.v3` - For configuration management

## Automatic Task Assignment

### Overview

The parser includes an intelligent task assignment feature that automatically assigns responsible persons to project tasks when they are not explicitly mentioned in the source document.

### How It Works

1. **Employee Pool**: The system maintains a pool of fictional employees with various roles in `prompts/employee_pool.json`
2. **AI Analysis**: The LLM analyzes each task's name and description
3. **Smart Matching**: Based on keywords and task type, the AI assigns the most suitable specialist(s)
4. **Preservation**: If responsible persons are already mentioned in the document, they are preserved as-is

### Available Roles

The system includes employees with the following specializations:

- **Руководитель проекта** (Project Manager) - Project coordination and planning
- **Бизнес-аналитик** (Business Analyst) - Requirements analysis and documentation
- **Архитектор решений** (Solution Architect) - System architecture and design
- **Backend разработчик** (Backend Developer) - Server-side development and APIs
- **Frontend разработчик** (Frontend Developer) - User interface development
- **Fullstack разработчик** (Fullstack Developer) - Full-stack web development
- **Тестировщик** (QA Engineer) - Testing and quality assurance
- **DevOps инженер** (DevOps Engineer) - CI/CD and infrastructure
- **UI/UX дизайнер** (UI/UX Designer) - Interface design and user experience
- **AI интегратор** (AI Integration Specialist) - AI/ML integration and LLM APIs
- **Data Scientist** - Data analysis and machine learning models
- **Технический писатель** (Technical Writer) - Technical documentation
- **Специалист по безопасности** (Security Specialist) - Information security
- **Мобильный разработчик** (Mobile Developer) - iOS/Android applications

### Assignment Examples

The AI uses keyword analysis to match tasks to specialists:

- "Разработка API" → Backend Developer
- "Дизайн интерфейса" → UI/UX Designer
- "Интеграция ChatGPT" → AI Integration Specialist
- "Тестирование модуля" → QA Engineer
- "Настройка CI/CD" → DevOps Engineer
- "Анализ требований" → Business Analyst

### Customization

To customize the employee pool, edit `prompts/employee_pool.json`:

```json
{
  "employees": [
    {
      "name": "Имя Фамилия",
      "role": "Должность на русском",
      "role_en": "Role in English",
      "specialization": ["область 1", "область 2"],
      "keywords": ["ключевое", "слово", "для", "поиска"]
    }
  ]
}
```

The system will automatically reload the employee pool when the parser is reinitialized.

## Performance Considerations

- **Large Documents**: The system handles large documents automatically with chunked processing
- **Asynchronous Processing**: Use goroutines for better performance
- **Rate Limiting**: Built-in rate limiting to prevent API abuse
- **Memory Management**: Efficient memory usage for large document processing

## Error Handling

The system implements comprehensive error handling with:

- Detailed error categorization
- Graceful degradation
- Fallback mechanisms
- Detailed error reporting

## Running the Demo

To run the demo application:

```bash
go run demo.go
```

This will process the sample document and show the extraction results.

## Building the Binary

To build a standalone binary:

```bash
go build -o zhcp-parser cmd/zhcp-parser/main.go
./zhcp-parser --help
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository.

---

**Note**: This is a prototype implementation. For production use, additional security measures and optimizations may be required.
