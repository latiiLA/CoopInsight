# EJ indexer / watcher

Indexes ATM electronic journal `.log` files into MongoDB for SwitchHub EJ search.

Uses the **same** `MONGO_URL` as CoopInsight, but database `EJ_DB_NAME` (default `ej_insight_db`).

## Env

```env
MONGO_URL=...
EJ_DB_NAME=ej_insight_db
# Linux deploy:
EJ_ROOT=/mnt/ej/Repository/EJ
# Windows (dev):
# EJ_ROOT=D:\EJ
# or \\fileserver\share\Repository\EJ

# Poller inside coopinsight (default on when EJ_ROOT is set)
EJ_WATCHER_ENABLED=true
EJ_POLL_INTERVAL=2m
```

## Automatic watch (preferred)

When `coopinsight` starts with `EJ_DB_NAME` + `EJ_ROOT` and `EJ_WATCHER_ENABLED` (default true):

1. On boot: indexes **today’s** files, then runs one **full** catch-up walk (long timeout)
2. Polls `EJ_ROOT` every `EJ_POLL_INTERVAL` (default **2 minutes**)
3. Most passes only look at **today’s** `YYYY_MM_DD_TERMINAL.log` files (they grow as ATMs write)
4. If mtime/size changed → append-parse from `parsed_offset` (or full reparse when schema bumps)
5. About hourly, a full walk rechecks older dates (unchanged files are skipped). Full walks use a ~45m timeout so large NFS/SMB trees are not aborted at the 2m poll interval.

Works the same on **Linux production** and **Windows** (no fsnotify; polling is reliable on NFS/SMB mounts).

### Deployment checklist

- `EJ_ROOT` must be a **mounted local path**, not an NFS export string.
  - Wrong: `EJ_ROOT=10.12.41.10:/ATM-Log/EJ` → `lstat ... no such file or directory`
  - Right:
    ```bash
    sudo mkdir -p /mnt/ej
    sudo mount -t nfs 10.12.41.10:/ATM-Log/EJ /mnt/ej
    # then in .env:
    EJ_ROOT=/mnt/ej
    ```
  - Persist the mount in `/etc/fstab` so it survives reboot.
- The API process user must be able to read `EJ_ROOT`.
- Filenames must match `YYYY_MM_DD_TERMINAL.log`. “Today” is the **API server’s local calendar date**.
- If search is empty for today, confirm those dated `.log` files exist under the mount (coverage will show missing until they do).
- First deploy / empty `ej_insight_db`: either restart the API (boot full walk) or run `go run ./cmd/ej-indexer` once.

## Manual / catch-up CLI

Parse/index activity is written to `logs/server.log` (watcher inside `coopinsight`)
and `logs/ej-indexer.log` (CLI). Look for `EJ parse started`, `EJ file indexed`,
and `EJ index walk finished`.

### Build the binary (on a machine with Go; ship like the API)

Linux production host (amd64):

```bash
cd backend
GOOS=linux GOARCH=amd64 go build -o ej-indexer ./cmd/ej-indexer
# copy ej-indexer next to your coopinsight binary on the server
```

Local Windows (for local EJ_ROOT only):

```bash
cd backend
go build -o ej-indexer.exe ./cmd/ej-indexer
```

### Run on the server (no Go source required)

Same folder / same `.env` as the API (`EJ_ROOT=/ATM-Log/EJ`, `EJ_DB_NAME`, `MONGO_URL`):

```bash
cd /data/coopinsight/backend   # or wherever the binary + .env live
./ej-indexer
# or:
./ej-indexer -root /ATM-Log/EJ
```

One file:

```bash
./ej-indexer -file /ATM-Log/EJ/WFDC0241/2026_10_20_WFDC0241.log
```

Optional: Linux cron or systemd timer for a nightly `./ej-indexer` if you want a second safety net; the in-process poller covers live “today” updates.

## API

After seeding `report:search-ej-transactions`:

`GET /api/reports/ej-transactions/search?cardFirst4=9231&cardLast4=6542&dateFrom=12/01/2024&dateTo=12/31/2024`
