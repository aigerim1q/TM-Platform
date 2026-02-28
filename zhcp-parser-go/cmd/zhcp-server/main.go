package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"zhcp-parser-go/internal/ai"
	"zhcp-parser-go/internal/ai/llm_providers/anthropic"
	"zhcp-parser-go/internal/ai/llm_providers/deepseek"
	"zhcp-parser-go/internal/ai/llm_providers/ollama"
	"zhcp-parser-go/internal/ai/llm_providers/openai"
	"zhcp-parser-go/internal/common"
	"zhcp-parser-go/internal/config"
	"zhcp-parser-go/internal/parser"
	"zhcp-parser-go/internal/server"
	"zhcp-parser-go/internal/storage/sqlite"

	"github.com/spf13/cobra"
)

var (
	configPath string
	dbPath     string
	port       string
)

var rootCmd = &cobra.Command{
	Use:   "zhcp-server",
	Short: "HTTP server for ЖЦП Parser",
	Long: `HTTP API server for the ЖЦП Parser service. 
Provides RESTful endpoints for document parsing and project management.`,
	Run: func(cmd *cobra.Command, args []string) {
		startServer()
	},
}

func init() {
	rootCmd.Flags().StringVarP(&configPath, "config", "c", "configs/llm_config.yaml", "Configuration file path")
	rootCmd.Flags().StringVarP(&dbPath, "db", "d", "zhcp.db", "Path to SQLite database")
	rootCmd.Flags().StringVarP(&port, "port", "p", "8080", "Server port")
}

func main() {
	// Register all LLM providers before starting
	registerProviders()

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

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

func startServer() {
	log.Println("🚀 Starting ЖЦП Parser HTTP Server...")

	// Initialize configuration
	configManager := config.NewConfigManager(configPath)
	cfg, err := configManager.LoadConfig()
	if err != nil {
		log.Fatalf("❌ Error loading configuration: %v", err)
	}
	log.Println("✅ Configuration loaded")

	// Initialize the parser
	zhcpParser, err := parser.NewZhcpParser(cfg)
	if err != nil {
		log.Fatalf("❌ Error initializing parser: %v", err)
	}
	defer zhcpParser.Close()
	log.Println("✅ Parser initialized")

	// Initialize database
	store := sqlite.New(dbPath)
	if err := store.Init(context.Background()); err != nil {
		log.Fatalf("❌ Error initializing database: %v", err)
	}
	log.Println("✅ Database initialized")

	// Create and start HTTP server
	srv := server.NewServer(zhcpParser, store, port, server.ServerOptions{
		AllowedOrigins:    splitCSVEnv("PARSER_CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:3002"),
		Workers:           intEnv("PARSER_WORKERS", 4),
		QueueSize:         intEnv("PARSER_QUEUE_SIZE", 64),
		JobTTL:            durationEnvSeconds("PARSER_JOB_TTL_SEC", 1800),
		ReadTimeout:       durationEnvSeconds("PARSER_READ_TIMEOUT_SEC", 20),
		ReadHeaderTimeout: durationEnvSeconds("PARSER_READ_HEADER_TIMEOUT_SEC", 10),
		WriteTimeout:      durationEnvSeconds("PARSER_WRITE_TIMEOUT_SEC", 30),
		IdleTimeout:       durationEnvSeconds("PARSER_IDLE_TIMEOUT_SEC", 60),
		ShutdownTimeout:   durationEnvSeconds("PARSER_SHUTDOWN_TIMEOUT_SEC", 10),
	})
	log.Printf("✅ Server configured on port %s\n", port)
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("📡 API Endpoints:")
	log.Println("  POST   /api/parse/upload")
	log.Println("  GET    /api/parse/status/{jobId}")
	log.Println("  GET    /api/parse/result/{jobId}")
	log.Println("  GET    /api/projects")
	log.Println("  GET    /api/projects/{id}")
	log.Println("  POST   /api/projects")
	log.Println("  PUT    /api/projects/{id}")
	log.Println("  DELETE /api/projects/{id}")
	log.Println("  GET    /api/projects/{projectId}/tasks")
	log.Println("  GET    /api/tasks/{id}")
	log.Println("  PUT    /api/tasks/{id}")
	log.Println("  PUT    /api/tasks/{id}/status")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	if err := srv.Start(ctx); err != nil {
		log.Fatalf("❌ Server error: %v", err)
	}
}

func splitCSVEnv(key, fallback string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		raw = fallback
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func intEnv(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func durationEnvSeconds(key string, fallback int) time.Duration {
	return time.Duration(intEnv(key, fallback)) * time.Second
}
