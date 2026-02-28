package config

import (
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv        string
	ServerAddr    string
	ShutdownGrace time.Duration
	ReadTimeout   time.Duration
	WriteTimeout  time.Duration
	IdleTimeout   time.Duration
	ReadHdrTO     time.Duration
	CORSOrigins   []string
	DBHost        string
	DBPort        string
	DBUser        string
	DBPassword    string
	DBName        string
	DBSSLMode     string
	JWTSecret     string
	ZHCPParserURL string
}

func Load() Config {
	_ = godotenv.Load()

	cfg := Config{
		AppEnv:        strings.ToLower(getEnv("APP_ENV", "development")),
		ServerAddr:    getEnv("SERVER_ADDR", ":8080"),
		ShutdownGrace: envDurationSeconds("SHUTDOWN_TIMEOUT_SEC", 10),
		ReadTimeout:   envDurationSeconds("HTTP_READ_TIMEOUT_SEC", 15),
		WriteTimeout:  envDurationSeconds("HTTP_WRITE_TIMEOUT_SEC", 30),
		IdleTimeout:   envDurationSeconds("HTTP_IDLE_TIMEOUT_SEC", 60),
		ReadHdrTO:     envDurationSeconds("HTTP_READ_HEADER_TIMEOUT_SEC", 10),
		CORSOrigins:   splitCSV(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")),
		DBHost:        getEnv("DB_HOST", "localhost"),
		DBPort:        getEnv("DB_PORT", "5432"),
		DBUser:        getEnv("DB_USER", "tm_user"),
		DBPassword:    getEnv("DB_PASSWORD", "tm_password"),
		DBName:        getEnv("DB_NAME", "tm_db"),
		DBSSLMode:     getEnv("DB_SSLMODE", "disable"),
		JWTSecret:     getEnv("JWT_SECRET", "change_me"),
		ZHCPParserURL: getEnv("ZHCP_PARSER_URL", "http://localhost:8081"),
	}

	if cfg.JWTSecret == "change_me" && cfg.AppEnv == "development" {
		log.Println("warning: JWT_SECRET is using the default value")
	}

	return cfg
}

func (c Config) Validate() error {
	if strings.TrimSpace(c.JWTSecret) == "" {
		return errors.New("JWT_SECRET is required")
	}
	if c.JWTSecret == "change_me" && c.AppEnv != "development" && c.AppEnv != "dev" && c.AppEnv != "test" {
		return errors.New("JWT_SECRET must be changed outside development")
	}
	if len(c.CORSOrigins) == 0 {
		return errors.New("at least one CORS_ALLOWED_ORIGINS value is required")
	}
	return nil
}

func (c Config) DatabaseDSN() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		c.DBUser,
		c.DBPassword,
		c.DBHost,
		c.DBPort,
		c.DBName,
		c.DBSSLMode,
	)
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envDurationSeconds(key string, fallbackSec int) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return time.Duration(fallbackSec) * time.Second
	}

	sec, err := strconv.Atoi(raw)
	if err != nil || sec <= 0 {
		return time.Duration(fallbackSec) * time.Second
	}
	return time.Duration(sec) * time.Second
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	return origins
}
