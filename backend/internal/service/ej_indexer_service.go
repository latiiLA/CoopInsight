package service

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"github.com/latiiLA/CoopInsight/backend/internal/service/ejparser"
	"github.com/sirupsen/logrus"
)

type EJIndexerResult struct {
	Scanned   int `json:"scanned"`
	Indexed   int `json:"indexed"`
	Skipped   int `json:"skipped"`
	Failed    int `json:"failed"`
	TxnUpsert int `json:"txnUpsert"`
}

// EJIndexOptions controls which files a root walk considers.
type EJIndexOptions struct {
	// TodayOnly limits to filenames whose date is local today (growing live EJ).
	TodayOnly bool
}

type EJIndexerService interface {
	IndexRoot(ctx context.Context, root string) (EJIndexerResult, error)
	IndexRootWithOptions(ctx context.Context, root string, opts EJIndexOptions) (EJIndexerResult, error)
	IndexFile(ctx context.Context, path string) error
}

// ejIndexSchemaVersion bumps force a one-time full reparse of registered files.
// v3: NCR newline/status. v4: line_start + raw_text. v5: customer account + camera images.
const ejIndexSchemaVersion = 5

type ejIndexerService struct {
	files repository.EJFileRepository
	txns  repository.EJTransactionRepository
}

func NewEJIndexerService(
	files repository.EJFileRepository,
	txns repository.EJTransactionRepository,
) EJIndexerService {
	return &ejIndexerService{files: files, txns: txns}
}

func (s *ejIndexerService) IndexRoot(ctx context.Context, root string) (EJIndexerResult, error) {
	return s.IndexRootWithOptions(ctx, root, EJIndexOptions{})
}

func (s *ejIndexerService) IndexRootWithOptions(
	ctx context.Context,
	root string,
	opts EJIndexOptions,
) (EJIndexerResult, error) {
	var result EJIndexerResult
	root = strings.TrimSpace(root)
	if root == "" {
		return result, nil
	}

	today := time.Now().Format("2006-01-02")
	started := time.Now()
	logrus.WithFields(logrus.Fields{
		"root":       root,
		"today_only": opts.TodayOnly,
	}).Info("EJ index walk started")

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			// Keep walking other terminals if one folder is unreachable.
			logrus.WithError(walkErr).WithField("path", path).Warn("EJ walk error")
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		if d.IsDir() {
			return nil
		}
		name := d.Name()
		if !strings.HasSuffix(strings.ToLower(name), ".log") {
			return nil
		}
		ejDate, _, ok := ejparser.ParseFilename(name)
		if !ok {
			return nil
		}
		if opts.TodayOnly && ejDate != today {
			return nil
		}
		result.Scanned++
		if err := s.indexOne(ctx, path, &result); err != nil {
			result.Failed++
			logrus.WithError(err).WithField("path", path).Warn("EJ index file failed")
		}
		return nil
	})

	logrus.WithFields(logrus.Fields{
		"root":        root,
		"today_only":  opts.TodayOnly,
		"scanned":     result.Scanned,
		"indexed":     result.Indexed,
		"skipped":     result.Skipped,
		"failed":      result.Failed,
		"txns":        result.TxnUpsert,
		"duration_ms": time.Since(started).Milliseconds(),
	}).Info("EJ index walk finished")
	return result, err
}

func (s *ejIndexerService) IndexFile(ctx context.Context, path string) error {
	var result EJIndexerResult
	return s.indexOne(ctx, path, &result)
}

func (s *ejIndexerService) indexOne(ctx context.Context, path string, result *EJIndexerResult) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	filename := filepath.Base(path)
	ejDate, terminalID, ok := ejparser.ParseFilename(filename)
	if !ok {
		terminalID = filepath.Base(filepath.Dir(path))
	}
	_ = ejDate

	existing, err := s.files.Find(ctx, terminalID, filename)
	if err != nil {
		return err
	}
	mtime := info.ModTime().UTC()
	size := info.Size()

	// One-time upgrades: locate fields, then NCR newline/status schema bump.
	if existing != nil && existing.TxnCount > 0 && existing.LinesBefore == 0 {
		return s.fullReparse(ctx, path, terminalID, filename, mtime, size, result, "full_locate_upgrade")
	}
	if existing != nil && existing.TxnCount > 0 && existing.SchemaVersion < ejIndexSchemaVersion {
		return s.fullReparse(ctx, path, terminalID, filename, mtime, size, result, "full_schema_upgrade")
	}

	if existing != nil &&
		existing.Size == size &&
		!existing.MTime.IsZero() &&
		existing.MTime.Equal(mtime) {
		result.Skipped++
		logrus.WithFields(logrus.Fields{
			"path":        path,
			"terminal_id": terminalID,
			"filename":    filename,
			"size":        size,
		}).Debug("EJ file unchanged, skipped")
		return nil
	}

	// Legacy rows (pre offset resume): treat registered size as already consumed.
	if existing != nil && existing.ParsedOffset == 0 && existing.TxnCount > 0 {
		if size == existing.Size && existing.MTime.Equal(mtime) {
			existing.ParsedOffset = existing.Size
			if err := s.files.Upsert(ctx, *existing); err != nil {
				return err
			}
			result.Skipped++
			logrus.WithFields(logrus.Fields{
				"path":          path,
				"terminal_id":   terminalID,
				"filename":      filename,
				"parsed_offset": existing.ParsedOffset,
			}).Info("EJ file offset upgraded (legacy row)")
			return nil
		}
		// File changed under a legacy row: full replace once to establish offset.
		return s.fullReparse(ctx, path, terminalID, filename, mtime, size, result, "full_legacy")
	}

	// Shrink or invalid offset: full reparse.
	if existing != nil && (size < existing.Size || existing.ParsedOffset > size) {
		return s.fullReparse(ctx, path, terminalID, filename, mtime, size, result, "full_shrink")
	}

	offset := int64(0)
	linesBefore := 0
	knownType := ""
	prevCount := 0
	if existing != nil {
		offset = existing.ParsedOffset
		linesBefore = existing.LinesBefore
		knownType = existing.AtmType
		prevCount = existing.TxnCount
	}

	mode := "append"
	if offset == 0 && (existing == nil || existing.TxnCount == 0) {
		mode = "first"
		linesBefore = 0
	}

	logrus.WithFields(logrus.Fields{
		"path":        path,
		"terminal_id": terminalID,
		"filename":    filename,
		"mode":        mode,
		"offset_from": offset,
		"size":        size,
		"atm_type":    knownType,
	}).Info("EJ parse started")

	atmType, txns, newOffset, newLinesBefore, err := ejparser.ParseFileFromOffset(
		path, offset, knownType, linesBefore,
	)
	if err != nil {
		logrus.WithError(err).WithFields(logrus.Fields{
			"path":        path,
			"terminal_id": terminalID,
			"filename":    filename,
			"mode":        mode,
			"offset_from": offset,
		}).Warn("EJ parse failed")
		return err
	}

	if len(txns) > 0 {
		if mode == "first" {
			if err := s.txns.ReplaceFileTransactions(ctx, terminalID, filename, txns); err != nil {
				return err
			}
			prevCount = 0
		} else {
			if err := s.txns.AppendTransactions(ctx, terminalID, filename, txns); err != nil {
				return err
			}
		}
	}

	txnCount := prevCount + len(txns)
	if mode == "first" {
		txnCount = len(txns)
	}

	if err := s.files.Upsert(ctx, model.EJFile{
		TerminalID:    terminalID,
		Filename:      filename,
		Path:          path,
		MTime:         mtime,
		Size:          size,
		ParsedOffset:  newOffset,
		LinesBefore:   newLinesBefore,
		SchemaVersion: ejIndexSchemaVersion,
		AtmType:       atmType,
		TxnCount:      txnCount,
		IndexedAt:     time.Now().UTC(),
	}); err != nil {
		return err
	}
	result.Indexed++
	result.TxnUpsert += len(txns)

	logrus.WithFields(logrus.Fields{
		"path":        path,
		"terminal_id": terminalID,
		"filename":    filename,
		"mode":        mode,
		"atm_type":    atmType,
		"offset_from": offset,
		"offset_to":   newOffset,
		"size":        size,
		"txn_new":     len(txns),
		"txn_total":   txnCount,
	}).Info("EJ file indexed")
	return nil
}

func (s *ejIndexerService) fullReparse(
	ctx context.Context,
	path, terminalID, filename string,
	mtime time.Time,
	size int64,
	result *EJIndexerResult,
	reason string,
) error {
	logrus.WithFields(logrus.Fields{
		"path":        path,
		"terminal_id": terminalID,
		"filename":    filename,
		"mode":        "full",
		"reason":      reason,
		"size":        size,
	}).Info("EJ parse started")

	atmType, txns, newOffset, newLinesBefore, err := ejparser.ParseFileFromOffset(path, 0, "", 0)
	if err != nil {
		logrus.WithError(err).WithFields(logrus.Fields{
			"path":        path,
			"terminal_id": terminalID,
			"filename":    filename,
			"mode":        "full",
			"reason":      reason,
		}).Warn("EJ parse failed")
		return err
	}
	if err := s.txns.ReplaceFileTransactions(ctx, terminalID, filename, txns); err != nil {
		return err
	}
	if err := s.files.Upsert(ctx, model.EJFile{
		TerminalID:    terminalID,
		Filename:      filename,
		Path:          path,
		MTime:         mtime,
		Size:          size,
		ParsedOffset:  newOffset,
		LinesBefore:   newLinesBefore,
		SchemaVersion: ejIndexSchemaVersion,
		AtmType:       atmType,
		TxnCount:      len(txns),
		IndexedAt:     time.Now().UTC(),
	}); err != nil {
		return err
	}
	result.Indexed++
	result.TxnUpsert += len(txns)

	logrus.WithFields(logrus.Fields{
		"path":        path,
		"terminal_id": terminalID,
		"filename":    filename,
		"mode":        "full",
		"reason":      reason,
		"atm_type":    atmType,
		"offset_from": 0,
		"offset_to":   newOffset,
		"size":        size,
		"txn_new":     len(txns),
		"txn_total":   len(txns),
	}).Info("EJ file indexed")
	return nil
}
