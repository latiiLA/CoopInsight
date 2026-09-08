# Database migrations and seeds

Custom migrator using the official MongoDB Go driver (not golang-migrate).

The API process does **not** run migrations or seeds on startup. Apply them manually before (or when) bringing the app up.

## Commands

From `backend/`:

```bash
go run ./cmd/migrate status
go run ./cmd/migrate up
go run ./cmd/migrate seed
go run ./cmd/migrate all
```

Uses `MONGO_URL` and `DB_NAME` from `.env` (cwd should be `backend/` so `godotenv` finds the file).

| Command | Effect |
|---|---|
| `up` | Schema indexes only |
| `seed` | Permissions, SUPERADMIN role, bootstrap admin (no indexes) |
| `all` | `up` then `seed` |

## Bootstrap admin env

| Variable | Required | Default |
|---|---|---|
| `BOOTSTRAP_ADMIN_PASSWORD` | **yes on first create** | — |
| `BOOTSTRAP_ADMIN_USERNAME` | no | `systemadmin` |
| `BOOTSTRAP_ADMIN_EMAIL` | no | `{username}@local` |

Password is written **only when the bootstrap admin user is created**. Re-running `seed` / `all` refreshes profile/role fields but does **not** reset the password.

Seeded permissions and the `SUPERADMIN` role use the system admin user id as `createdBy` / `updatedBy`.

## First login

1. Set `BOOTSTRAP_ADMIN_PASSWORD` in `.env` (first create only)
2. `go run ./cmd/migrate all`
3. Sign in with local login (`VITE_LOGIN_TYPE=login`):
   - username: `systemadmin` (unless overridden)
   - password: the password used at create time
