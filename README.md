# TM Platform (Go + Next.js)

## Быстрый старт

### 1) Postgres + миграции + фронт (через Docker)
- В корне проекта: `docker compose up --build`
- Фронт: http://localhost:3000

### 2) Бэк (локально)
- В новом терминале:
  - `cd backend`
  - `cp .env.example .env`
  - `go run cmd/server/main.go`
- API: http://localhost:8080

## API (минимум)
- `POST /auth/register` {"email":"a@b.com","password":"pass"}
- `POST /auth/login` {"email":"a@b.com","password":"pass"}
- `GET /projects` (Authorization: Bearer <token>)
- `POST /projects` {"name":"Project","description":"..."}
