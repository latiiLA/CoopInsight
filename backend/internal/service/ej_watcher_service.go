package service

import (
	"context"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
)

// EJWatcherService periodically polls EJ_ROOT for changed/growing log files.
// Polling is used instead of fsnotify so the same code works on Windows and
// Linux, including network mounts where inotify/SMB events are unreliable.
type EJWatcherService interface {
	Start(ctx context.Context)
}

type ejWatcherService struct {
	indexer   EJIndexerService
	root      string
	interval  time.Duration
	fullEvery int // every N ticks, walk all dates; otherwise today-only
	tickCount int
}

func NewEJWatcherService(
	indexer EJIndexerService,
	root string,
	interval time.Duration,
) EJWatcherService {
	if interval < 15*time.Second {
		interval = 2 * time.Minute
	}
	return &ejWatcherService{
		indexer:   indexer,
		root:      strings.TrimSpace(root),
		interval:  interval,
		fullEvery: 30, // e.g. 2m * 30 ≈ hourly full catch-up
	}
}

func (w *ejWatcherService) Start(ctx context.Context) {
	if w == nil || w.indexer == nil || w.root == "" {
		logrus.Info("EJ watcher idle (missing indexer or EJ_ROOT)")
		return
	}

	logrus.WithFields(logrus.Fields{
		"root":     w.root,
		"interval": w.interval.String(),
	}).Info("EJ watcher started (poll)")

	// Today first (fast), then one full catch-up so a fresh deploy does not wait
	// ~1h before historical journals are walked. Start already runs in a
	// background goroutine, so blocking here is fine.
	w.runOnce(ctx, true)
	w.runOnce(ctx, false)

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			logrus.Info("EJ watcher stopped")
			return
		case <-ticker.C:
			w.tickCount++
			full := w.fullEvery > 0 && w.tickCount%w.fullEvery == 0
			w.runOnce(ctx, !full)
		}
	}
}

func (w *ejWatcherService) passTimeout(todayOnly bool) time.Duration {
	if todayOnly {
		// Growing "today" files should finish well within one poll interval.
		if w.interval < 2*time.Minute {
			return 2 * time.Minute
		}
		return w.interval
	}
	// Full walks on a large NFS/SMB EJ tree routinely exceed the poll interval
	// (local 1.5k files took ~2-4 minutes; production shares are slower).
	// A 2m deadline was aborting historical indexing before it finished.
	timeout := 45 * time.Minute
	if min := w.interval * 30; min > timeout {
		timeout = min
	}
	return timeout
}

func (w *ejWatcherService) runOnce(ctx context.Context, todayOnly bool) {
	timeout := w.passTimeout(todayOnly)
	passCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	opts := EJIndexOptions{TodayOnly: todayOnly}
	started := time.Now()
	result, err := w.indexer.IndexRootWithOptions(passCtx, w.root, opts)
	if err != nil && ctx.Err() == nil {
		logrus.WithError(err).WithFields(logrus.Fields{
			"today_only":  todayOnly,
			"timeout":     timeout.String(),
			"duration_ms": time.Since(started).Milliseconds(),
		}).Warn("EJ watcher pass failed")
		return
	}
	logrus.WithFields(logrus.Fields{
		"today_only":  todayOnly,
		"timeout":     timeout.String(),
		"scanned":     result.Scanned,
		"indexed":     result.Indexed,
		"skipped":     result.Skipped,
		"failed":      result.Failed,
		"txns":        result.TxnUpsert,
		"duration_ms": time.Since(started).Milliseconds(),
	}).Info("EJ watcher pass complete")
}
