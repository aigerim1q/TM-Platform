# TM-Platform: Что Было Реализовано

Этот документ фиксирует изменения, выполненные по плану улучшений (безопасность, надежность, нагрузка, качество).

## 1. Безопасность (Auth и токены)

- Убрано логирование чувствительных данных в `register` (raw body и payload с паролем).
- JWT переведен на typed claims:
  - добавлен `token_type` (`access`/`refresh`)
  - добавлен `jti`
  - добавлена строгая проверка алгоритма подписи (`HS256`).
- Реализован refresh rotation + revoke:
  - добавлена таблица `auth_refresh_tokens`
  - refresh-токен стал одноразовым
  - украденный старый refresh после ротации больше невалиден.
- Добавлен cookie-based refresh flow:
  - refresh токен ставится в `HttpOnly` cookie (`refresh_token`)
  - при `/auth/refresh` токен берется из body или cookie
  - JSON-ответ сохранен для совместимости.

## 2. API hardening

- `POST /upload` перенесен под JWT middleware (больше не публичный).
- Добавлен rate limiting по IP:
  - на `/auth/*`
  - на `/upload`.
- CORS переведен на allowlist из env (`CORS_ALLOWED_ORIGINS`) вместо hardcoded `localhost`.
- Добавлен `/ready` endpoint в backend.

## 3. Надежность backend

- Добавлена валидация конфига при старте:
  - запрет `JWT_SECRET=change_me` вне dev
  - обязательный CORS allowlist.
- Добавлены server timeouts:
  - `ReadHeaderTimeout`
  - `ReadTimeout`
  - `WriteTimeout`
  - `IdleTimeout`.
- Добавлен graceful shutdown по `SIGINT/SIGTERM`.

## 4. Надежность zhcp-parser-go под нагрузкой

- Реализована bounded queue для задач парсинга.
- Добавлен worker pool (ограничение параллелизма).
- Добавлен backpressure: при переполнении очереди возвращается 503.
- Добавлен TTL cleanup завершенных/ошибочных jobs.
- Добавлены server timeouts и graceful shutdown.
- Добавлены `/health` и `/ready`.
- Параметры вынесены в env:
  - `PARSER_WORKERS`
  - `PARSER_QUEUE_SIZE`
  - `PARSER_JOB_TTL_SEC`
  - `PARSER_CORS_ALLOWED_ORIGINS`
  - timeout-переменные.

## 5. Frontend session hardening

- Модель токенов изменена:
  - access token хранится в памяти (не в `localStorage`)
  - refresh делается через `HttpOnly` cookie + `withCredentials`.
- Обновлен axios refresh interceptor под cookie-flow.
- Middleware на фронте проверяет refresh cookie и expiry JWT.
- Удалены блокирующие проверки `getAccessToken()` в местах, где должен работать cookie-refresh (header/live notifications).

## 6. Производительность (N+1 fix для AI context)

- Добавлен серверный агрегирующий endpoint:
  - `GET /workspace/context`.
- AI chat на фронте переведен на этот endpoint.
- Убрана клиентская каскадная загрузка `projects -> stages -> tasks`.

## 7. Архитектурная чистка

- Удален legacy Fiber handler `backend/internal/projects/handler.go`.
- Удалены неиспользуемые Fiber-зависимости из backend модульной части.

## 8. Quality gates и CI

- Добавлен GitHub Actions workflow `.github/workflows/ci.yml`:
  - backend: `go test`, `go vet`, `staticcheck`
  - parser: `GOWORK=off go test`, `GOWORK=off go vet`
  - frontend: `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- На фронте:
  - убран `ignoreBuildErrors` из `next.config.mjs`
  - добавлен рабочий lint config (`eslint.config.mjs`)
  - добавлен `typecheck` script в `package.json`.

## 9. Workspace / модули

- `go.work` обновлен: теперь включает и `backend`, и `zhcp-parser-go`.
- Тесты parser приведены в рабочее состояние:
  - регистрация провайдеров в тесте
  - переписан интеграционный DB тест под текущий storage API.

## 10. Инфраструктура и env

- Обновлен `.env.example`:
  - удален реальный ключ
  - добавлены `APP_ENV`, `CORS_ALLOWED_ORIGINS` и базовые backend переменные.
- Обновлен `docker-compose.yml`:
  - backend берет `JWT_SECRET` и `CORS_ALLOWED_ORIGINS` из env
  - parser берет параметры очереди/CORS из env.

## 11. Что проверено после изменений

Выполнены и прошли:

- `backend`: `go test ./...`, `go vet ./...`, `staticcheck ./...`
- `zhcp-parser-go`: `go test ./...`, `GOWORK=off go vet ./...`
- `frontend/dashboardredesign`: `pnpm typecheck`, `pnpm lint`, `pnpm build`

## 12. Остаточные моменты

- В Next.js 16 есть предупреждение: файл `middleware.ts` считается deprecated в пользу `proxy.ts`.
- Крупные файлы (`projects/http_handler.go`, `projects/repository.go` и крупные frontend страницы) пока не декомпозированы полностью.

## 13. Ключевые файлы, затронутые в реализации

- Backend:
  - `backend/internal/auth/*`
  - `backend/internal/httpapi/*`
  - `backend/internal/config/config.go`
  - `backend/cmd/server/main.go`
  - `backend/internal/projects/http_handler.go`
  - `backend/internal/projects/repository.go`
  - `backend/migrations/032_auth_refresh_tokens.*.sql`
- Parser:
  - `zhcp-parser-go/internal/server/server.go`
  - `zhcp-parser-go/cmd/zhcp-server/main.go`
  - `zhcp-parser-go/test/*.go`
- Frontend:
  - `frontend/dashboardredesign/lib/api.ts`
  - `frontend/dashboardredesign/lib/auth.ts`
  - `frontend/dashboardredesign/middleware.ts`
  - `frontend/dashboardredesign/components/ai-chat-content.tsx`
  - `frontend/dashboardredesign/components/header.tsx`
  - `frontend/dashboardredesign/components/live-notification-toaster.tsx`
  - `frontend/dashboardredesign/next.config.mjs`
  - `frontend/dashboardredesign/eslint.config.mjs`
  - `frontend/dashboardredesign/package.json`
- CI:
  - `.github/workflows/ci.yml`

