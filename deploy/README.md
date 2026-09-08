# Deploy with nginx

Serves the built SPA from `frontend/dist` and reverse-proxies `/api` and `/uploads` to the Go API.

| What | Value |
|---|---|
| Public URL | `https://localhost:8443` |
| TLS files | `certificates/selfsigned.crt` + `certificates/selfsigned.key` (same files the API uses via `CERT_FILE` / `KEY_FILE`) |
| Upstream API | `https://127.0.0.1:8088` |
| Static root | `frontend/dist` |

## One-time setup

1. Put certificates in [`certificates/`](../certificates/README.md).
2. Build the frontend (`VITE_API_URL=/api`):

```bash
cd frontend
npm install
npm run build
```

3. Start the API on **https://127.0.0.1:8088**.
4. Ensure `tmp/` exists at the repo root (nginx writes pid/logs there):

```bash
mkdir -p tmp
```

## Run

From the **repo root** (so `-p` makes `certificates/` and `frontend/dist` resolve):

```bash
nginx -p "$(pwd)" -c deploy/nginx/nginx.conf
```

Open **https://localhost:8443**.

Reload after config changes:

```bash
nginx -p "$(pwd)" -c deploy/nginx/nginx.conf -s reload
```

Stop:

```bash
nginx -p "$(pwd)" -c deploy/nginx/nginx.conf -s stop
```

After frontend changes, run `npm run build` again and refresh the browser (no nginx restart needed unless `nginx.conf` changed).
