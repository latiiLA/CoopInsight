# Switch Hub (CoopInsight)

ATM/POS analytics, switch monitoring, and admin tooling. Backend is Go (Gin + Mongo + optional Oracle/SSH). Frontend is React (Vite).

## Prerequisites

- Go 1.22+ (see `backend/go.mod`)
- Node.js 20+ (frontend)
- MongoDB reachable at `MONGO_URL`
- Optional: Oracle TLOG, source Mongo (TMS), SSH to switch hosts

## First-time setup

### 1. Backend env

```bash
cd backend
cp .env.example .env
```

Set at least:

- `MONGO_URL`, `DB_NAME`
- `JWT_SECRET`, `REFRESH_JWT_SECRET`
- `APP_TIMEOUT`, `FILE_UPLOAD_PATH`, `LOG_LEVEL`
- `BOOTSTRAP_ADMIN_PASSWORD` (used only the first time the bootstrap admin is created)

Other keys (`ORACLE_*`, `SOURCE_MONGO_*`, `SSH_SWITCH_*`, mail, LDAP) are documented in `.env.example`.

### 2. Migrate and seed (manual)

The API does **not** auto-migrate. From `backend/`:

```bash
go run ./cmd/migrate all
```

This applies indexes, seeds permissions + `SUPERADMIN`, and creates the bootstrap admin (`systemadmin` by default). Re-running seed does **not** reset that user’s password. Details: [backend/db/README.md](backend/db/README.md).

### 3. Run the API

```bash
cd backend
go run ./cmd/coopinsight
# or: air   (if you use hot reload)
```

Default listen port follows the app’s HTTP server config (commonly `:8080`).

### 4. Frontend env and dev server

```bash
cd frontend
cp .env.example .env
```

Typical local values:

```env
VITE_API_URL=/api
VITE_LOGIN_TYPE=login
VITE_LIVE_MONITORING_ENABLED=false
```

Use `VITE_LOGIN_TYPE=login` for the seeded Mongo admin; use `login-ldap` when LDAP is configured on the backend.

```bash
npm install
npm run dev
```

Sign in as `systemadmin` with the password you set in `BOOTSTRAP_ADMIN_PASSWORD` at first seed.

## Useful commands

| Area | Command |
|---|---|
| Migration status | `cd backend && go run ./cmd/migrate status` |
| Indexes only | `cd backend && go run ./cmd/migrate up` |
| Seeds only | `cd backend && go run ./cmd/migrate seed` |
| Frontend build | `cd frontend && npm run build` |

## Repo layout

- `backend/` — API, migrate CLI, Mongo seeds
- `frontend/` — Vite React SPA

Keep backend and frontend changes in **separate git commits**.
