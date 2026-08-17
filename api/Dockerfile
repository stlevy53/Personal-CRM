# --- Build stage ---
FROM golang:1.22-alpine AS build
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /out/api ./main.go
RUN CGO_ENABLED=0 go build -o /out/migrate ./cmd/migrate

# --- Runtime stage ---
FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=build /out/api /usr/local/bin/api
COPY --from=build /out/migrate /usr/local/bin/migrate
EXPOSE 8080
CMD ["api"]
