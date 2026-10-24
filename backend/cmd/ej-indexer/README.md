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

1. Polls `EJ_ROOT` every `EJ_POLL_INTERVAL` (default **2 minutes**)
2. Most passes only look at **today’s** `YYYY_MM_DD_*.log` files (they grow as ATMs write)
3. If mtime/size changed → append-parse from `parsed_offset` (or full reparse when schema bumps)
4. Older dated files are skipped when unchanged; a slower full walk (~hourly) still applies schema upgrades (e.g. backfill EJ line / journal text)

Works the same on **Linux production** and **Windows** (no fsnotify; polling is reliable on NFS/SMB mounts).

## Manual / catch-up CLI

From `backend/`:

```bash
Parse/index activity is written to `logs/server.log` (watcher inside `coopinsight`)
and `logs/ej-indexer.log` (CLI). Look for `EJ parse started`, `EJ file indexed`,
and `EJ index walk finished`.

# Full walk of EJ_ROOT (skips unchanged mtime/size)
go run ./cmd/ej-indexer

# One file
go run ./cmd/ej-indexer -file /path/to/2024_12_03_DDWC0483.log
```

Optional: Linux cron or systemd timer for a nightly full `ej-indexer` if you want a second safety net; the in-process poller is enough for live “today” updates.

## API

After seeding `report:search-ej-transactions`:

`GET /api/reports/ej-transactions/search?cardFirst4=9231&cardLast4=6542&dateFrom=12/01/2024&dateTo=12/31/2024`
