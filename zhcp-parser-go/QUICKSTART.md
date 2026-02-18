# ЖЦП Parser - Быстрый старт

## 🚀 Установка и запуск

### Шаг 1: Установка

```bash
cd zhcp-parser-go
go mod tidy
```

### Шаг 2: Конфигурация LLM

Создайте или отредактируйте `configs/llm_config.yaml`:

```yaml
providers:
  ollama:
    enabled: true
    model: "llama3"
    base_url: "http://localhost:11434"
    temperature: 0.1
```

Для облачных провайдеров установите переменные окружения:

```bash
export OPENAI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
```

### Шаг 3: Запуск

```bash
# Парсинг документа
go run cmd/zhcp-parser/main.go parse path/to/document.pdf

# С опциями
go run cmd/zhcp-parser/main.go parse document.pdf --validate --enrich --output result.json

# Или скомпилировать
go build -o zhcp-parser cmd/zhcp-parser/main.go
./zhcp-parser parse document.pdf
```

## 🤖 Автоматическое назначение ответственных

LLM автоматически назначает специалистов на задачи:

- "Разработка API" → Backend разработчик
- "Дизайн интерфейса" → UI/UX дизайнер
- "Интеграция AI" → AI интегратор
- "Тестирование" → Тестировщик
- "Настройка CI/CD" → DevOps инженер

### Пул сотрудников

Настраивается в `prompts/employee_pool.json`. Включает 14 специалистов различных должностей.

## 📝 Пример

Тестовый документ: `testdata/sample_project.txt`

```bash
go run cmd/zhcp-parser/main.go parse testdata/sample_project.txt
```

## 📚 Документация

- [README.md](README.md) - Полная документация
- [AUTO_ASSIGNMENT_FEATURE.md](../AUTO_ASSIGNMENT_FEATURE.md) - Детали автоназначения
- [configs/llm_config.yaml](configs/llm_config.yaml) - Конфигурация

## ✅ Результаты

Сохраняются в:

- JSON файл (указанный или автоматически на Desktop/Downloads)
- SQLite база данных `zhcp.db`
