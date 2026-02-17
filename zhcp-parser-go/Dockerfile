FROM golang:1.24-bookworm

WORKDIR /app

# Install build tools needed for CGO dependencies (sqlite driver)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY go.mod go.sum ./
RUN go mod download

COPY . .

EXPOSE 8081

CMD ["go", "run", "cmd/zhcp-server/main.go", "--port", "8081", "--config", "configs/llm_config.yaml", "--db", "/data/zhcp.db"]
