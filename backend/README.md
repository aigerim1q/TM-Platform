# TM Platform Backend (Go)

## Structure
```
backend/
  cmd/server
  internal/
    auth
    config
    db
    httpapi
    projects
  migrations
  docker-compose.yml
```

## Quick start
1. Start Postgres:
   - `docker compose -f backend/docker-compose.yml up -d`
2. Create env file:
   - `cp backend/.env.example backend/.env`
3. Run migrations (example with golang-migrate):
   - `migrate -path backend/migrations -database "postgres://tm_user:tm_password@localhost:5432/tm_db?sslmode=disable" up`
4. Start server:
   - `go run backend/cmd/server/main.go`

## API
- `POST /auth/register` {"email":"a@b.com","password":"pass"}
- `POST /auth/login` {"email":"a@b.com","password":"pass"}
- `GET /projects` (Authorization: Bearer <token>)
- `POST /projects` {"name":"Project","description":"..."}
