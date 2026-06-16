# Explain codebase (example output)

**Entry:** `services/api/cmd/server/main.go` (synthetic)

## Map

- **main** loads config, OTel, HTTP router, **middleware** (auth, logging)
- **Domain** packages: `user`, `auth`, `billing` — no cross-import cycles observed at top level

## Key flows

- **Request** → `middleware.Auth` → handler → `store` (Postgres) → JSON

## Pointers

- **Auth** tokens validated in `internal/auth/jwt.go`
- **Migrations** in `migrations/`

*High-level; run symbol search for full detail in IDE.*
