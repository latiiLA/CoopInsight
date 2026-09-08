# TLS material (shared by nginx and the Go API)

Place these two files here:

- `selfsigned.crt`
- `selfsigned.key`

Nginx loads them via `certificates/` (see `deploy/nginx/nginx.conf`).

The API loads them from `backend/` using relative paths in `.env`:

```env
CERT_FILE=../certificates/selfsigned.crt
KEY_FILE=../certificates/selfsigned.key
```

Run `air` / `go run` from `backend/` so those paths resolve.

Certificate and key files are gitignored; only this README is tracked.
