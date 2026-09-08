# Agent guide — Switch Hub (CoopInsight)

Instructions for Cursor (and similar) agents verifying this repo. Prefer these steps over guessing ports or starting duplicate servers.

## Do / don’t

- **Do not** start a second `air` / API process if the user already has one running (check terminals / `netstat` for `:8088`).
- **Do not** commit `.env`, certificates, or `frontend/` + `backend/` in the same commit.
- Prefer smoke checks below after UI/API changes that affect login, routing, or nginx.

## Local services

| Service | URL | Notes |
|---|---|---|
| API (HTTPS) | `https://127.0.0.1:8088` | `air` or `go run ./cmd/coopinsight` from `backend/` (certs: `../certificates/`) |
| Vite dev | Vite default (often `http://localhost:5173`) | proxies `/api` → `:8088` |
| nginx prod-like | `https://localhost:8443` | serves `frontend/dist`; see `deploy/README.md` |
| Health | `GET /health` or `GET /api/health` | JSON `{ "status": "ok", ... }` |

Self-signed TLS: use `curl -k` / browser “accept risk”.

## Smoke check (API)

From repo root (PowerShell-friendly script):

```bash
# API only
powershell -File scripts/smoke-check.ps1
# or (Git Bash / WSL):
./scripts/smoke-check.sh
```

Optional login probe (reads `backend/.env` for `BOOTSTRAP_ADMIN_*` — never print the password):

```bash
powershell -File scripts/smoke-check.ps1 -Login
./scripts/smoke-check.sh --login
```

## Browser / UI smoke (manual or agent browser)

1. Open Vite or `https://localhost:8443`.
2. Login form selectors:
   - `data-testid="login-form"`
   - `data-testid="login-username"`
   - `data-testid="login-password"`
   - `data-testid="login-submit"`
3. Use local login (`VITE_LOGIN_TYPE=login`) with bootstrap admin from `backend/.env` (`BOOTSTRAP_ADMIN_USERNAME`, default `systemadmin`).
4. Expect redirect to `/home` on success.

## After relevant changes

| Change | Verify |
|---|---|
| Auth / permissions | Login smoke + one gated page still loads |
| Vite proxy / API port | `scripts/smoke-check` against `:8088` |
| nginx.conf | health via `https://localhost:8443/api/health` (or `/health`) with API up |
| Seeds / migrate | `go run ./cmd/migrate status` from `backend/` |

## Build / CI commands

```bash
cd backend && go test ./... && go build ./...
cd frontend && npm run build
```
