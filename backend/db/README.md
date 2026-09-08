# Database migrations and seeds

Custom migrator using the official MongoDB Go driver (not golang-migrate).

## Commands

From `backend/`:

```bash
go run ./cmd/migrate status
go run ./cmd/migrate up
go run ./cmd/migrate seed
go run ./cmd/migrate all
```

Uses `MONGO_URL` and `DB_NAME` from `.env`.

## Bootstrap admin env

| Variable | Required | Default |
|---|---|---|
| `BOOTSTRAP_ADMIN_PASSWORD` | **yes** | — |
| `BOOTSTRAP_ADMIN_USERNAME` | no | `systemadmin` |
| `BOOTSTRAP_ADMIN_EMAIL` | no | `{username}@local` |

Seeded permissions and the `SUPERADMIN` role use the system admin user id as `createdBy` / `updatedBy`.

## First login

1. Set `BOOTSTRAP_ADMIN_PASSWORD` in `.env`
2. `go run ./cmd/migrate seed` (or `all`)
3. Sign in with local login (`VITE_LOGIN_TYPE=login`):
   - username: `systemadmin` (unless overridden)
   - password: value of `BOOTSTRAP_ADMIN_PASSWORD`
