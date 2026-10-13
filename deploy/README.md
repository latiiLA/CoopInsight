# Deploy with nginx

Serves the built SPA from `frontend/dist` and reverse-proxies `/api` and `/uploads` to the Go API.

| What | Value |
|---|---|
| Public URL (signed-in app) | `https://<this-host>:8443` |
| **Grafana embed (HTTP)** | `http://<this-host>:8089/embed.html` |
| TLS files | `certificates/selfsigned.crt` + `certificates/selfsigned.key` (same files the API uses via `CERT_FILE` / `KEY_FILE`) |
| Upstream API | `https://127.0.0.1:8088` |
| Static root | `frontend/dist` |

On the shared prod host (`10.12.53.210`), **:80 / :443 are Coop Forex**, not Switch Hub. Grafana must iframe **HTTP `:8089`**, not port 80. HTTPS `:8443` works for the app but prompts for the self-signed cert inside Grafana.

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

Open **https://localhost:8443** for the signed-in app.

### Grafana iframe (production)

Use the Switch Hub host and **port 8089** (HTTP). Example for `10.12.53.210`:

```html
<iframe
  src="http://10.12.53.210:8089/embed.html?view=summary&flow=overall&refresh=60#YOUR_EMBED_API_KEY"
  width="100%"
  height="1000"
  style="border: none;"
></iframe>
```

`frame-ancestors` in `deploy/nginx/nginx.conf` must list every Grafana origin (scheme + host + port), e.g. `http://10.12.52.20:3000`. Update that map if Grafana moves.

Reload after config changes:

```bash
nginx -p "$(pwd)" -c deploy/nginx/nginx.conf -s reload
```

Stop:

```bash
nginx -p "$(pwd)" -c deploy/nginx/nginx.conf -s stop
```

After frontend changes, run `npm run build` again and refresh the browser (no nginx restart needed unless `nginx.conf` changed).

## Production checklist (embed HTTP on :8089)

After pulling/copying this repo onto the server (e.g. `/data/coopinsight`):

1. Confirm the running config listens on **8089** (not 80):
   ```bash
   grep -n "listen 8089" deploy/nginx/nginx.conf
   ```
2. Reload nginx from the **repo root**:
   ```bash
   nginx -p "$(pwd)" -c deploy/nginx/nginx.conf -s reload
   # or stop/start if reload fails
   ```
3. Confirm something is bound:
   ```bash
   ss -tlnp | grep -E "8089|8443"
   # expect 0.0.0.0:8089 and 0.0.0.0:8443 (not only 127.0.0.1)
   ```
4. Open the host firewall for TCP **8089** if clients cannot connect (ufw / firewalld / iptables / security group).
5. Verify from a client machine:
   ```bash
   curl -sI http://10.12.53.210:8089/embed.html
   # expect HTTP/1.1 200 and Content-Security-Policy: frame-ancestors ...
   curl -skI https://10.12.53.210:8443/embed.html
   # expect 200; after this config is live, CSP should be present here too
   ```
6. Point Grafana panels at `http://10.12.53.210:8089/embed.html...` — **not** `http://10.12.53.210/embed.html` (that is Coop Forex on :80).
