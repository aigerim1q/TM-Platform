# TM Platform (Go + Next.js)

## Что уже сделано (кратко)
- Realtime тосты уведомлений по новым событиям (появляются в углу и исчезают автоматически).
- Удаление проекта теперь сразу убирает связанные карточки задач на дашборде без ручного refresh.
- Улучшен доступ к задачам для делегированных исполнителей (редактирование/управление ответственными).
- Убраны статичные фолбэки, которые мигали при загрузке страниц.

## Быстрый старт

### 1) Postgres + миграции + фронт (через Docker)
- В корне проекта: `docker compose up --build`
- Фронт: http://localhost:3000

### 2) Запуск без Docker (локально)

1. Поднять локальный PostgreSQL и создать БД/пользователя:
   - `createdb tm_db`
   - `psql -d postgres -c "CREATE USER tm_user WITH PASSWORD 'tm_password';"`
   - `psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE tm_db TO tm_user;"`

2. Применить миграции:
   - `migrate -path backend/migrations -database "postgres://tm_user:tm_password@localhost:5432/tm_db?sslmode=disable" up`

3. Запустить backend:
   - `cd backend`
   - `cp .env.example .env`
   - `go run cmd/server/main.go`
   - API: http://localhost:8080

4. Запустить frontend:
   - `cd frontend/dashboardredesign`
   - `pnpm install`
   - `pnpm dev`
   - Frontend: http://localhost:3000

## API (минимум)
- `POST /auth/register` {"email":"a@b.com","password":"pass"}
- `POST /auth/login` {"email":"a@b.com","password":"pass"}
- `GET /projects` (Authorization: Bearer <token>)
- `POST /projects` {"name":"Project","description":"..."}
