package service

import (
	"context"
	"math"
	"os"
	"path/filepath"
	"strings"
	"unicode"

	"github.com/latiiLA/CoopInsight/backend/configs"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"github.com/latiiLA/CoopInsight/backend/internal/service/ejparser"
	"github.com/sirupsen/logrus"
)

// Max bytes returned for "View whole file" (large day files are truncated).
const ejJournalFileMaxBytes = 5 * 1024 * 1024

type EJTransactionSearchService interface {
	Search(
		ctx context.Context,
		req model.EJTransactionSearchRequest,
		page, pageSize int,
	) (*model.EJTransactionSearchResult, error)
	GetByID(ctx context.Context, id string) (*model.EJTransaction, error)
	GetJournal(ctx context.Context, id string) (*model.EJJournalView, error)
	GetJournalFile(ctx context.Context, id string) (*model.EJJournalFileView, error)
	// OpenJournalDownload resolves a readable path and safe download name for streaming.
	OpenJournalDownload(ctx context.Context, id string) (path, downloadName string, err error)
}

type ejTransactionSearchService struct {
	repository repository.EJTransactionRepository
	files      repository.EJFileRepository
}

func NewEJTransactionSearchService(
	repository repository.EJTransactionRepository,
	files repository.EJFileRepository,
) EJTransactionSearchService {
	return &ejTransactionSearchService{repository: repository, files: files}
}

func (s *ejTransactionSearchService) Search(
	ctx context.Context,
	req model.EJTransactionSearchRequest,
	page, pageSize int,
) (*model.EJTransactionSearchResult, error) {
	if s == nil || s.repository == nil {
		return nil, common.ErrEJSearchUnavailable
	}
	req = normalizeEJSearchRequest(req)
	if !ejSearchHasCriteria(req) {
		return nil, common.ErrEJSearchNeedsCriteria
	}

	items, hasMore, err := s.repository.Search(ctx, req, page, pageSize)
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []model.EJTransaction{}
	}
	return &model.EJTransactionSearchResult{
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
		Items:    items,
	}, nil
}

func (s *ejTransactionSearchService) GetByID(
	ctx context.Context,
	id string,
) (*model.EJTransaction, error) {
	if s == nil || s.repository == nil {
		return nil, common.ErrEJSearchUnavailable
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, common.ErrInvalidEJTransactionID
	}
	return s.repository.GetByID(ctx, id)
}

func (s *ejTransactionSearchService) GetJournal(
	ctx context.Context,
	id string,
) (*model.EJJournalView, error) {
	row, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	view := &model.EJJournalView{
		ID:         row.ID.Hex(),
		TerminalID: row.TerminalID,
		Filename:   row.Filename,
		Path:       row.Path,
		EJDate:     row.EJDate,
		LineStart:  row.LineStart,
		LineEnd:    row.LineEnd,
		FileOffset: row.FileOffset,
		RawText:    strings.TrimSpace(row.RawText),
		Source:     "indexed",
	}
	if view.RawText != "" {
		view.RawText = ejparser.NormalizeEJText(view.RawText)
		return view, nil
	}

	path := s.resolveJournalPath(ctx, row)
	view.Path = path

	// Prefer stored byte offset when locate metadata exists (line_start set on index).
	if path != "" && row.LineStart > 0 {
		raw, rerr := readEJBlockFromFile(path, row.FileOffset, row.AtmType)
		if rerr == nil && strings.TrimSpace(raw) != "" {
			view.RawText = raw
			view.Source = "file"
			return view, nil
		}
	}

	// Older rows: find the block by time / card / auth inside the file.
	if path != "" {
		located, lerr := ejparser.LocateTransactionBlock(path, ejparser.LocateTip{
			AtmType:    row.AtmType,
			StartTime:  row.StartTime,
			EndTime:    row.EndTime,
			AuthNum:    row.AuthNum,
			CardFirst4: row.CardFirst4,
			CardLast4:  row.CardLast4,
			Amount:     row.Amount,
		})
		if lerr == nil && located != nil && strings.TrimSpace(located.RawText) != "" {
			view.RawText = located.RawText
			view.FileOffset = located.Offset
			view.LineStart = located.LineStart
			view.LineEnd = located.LineEnd
			view.Source = "file"
			return view, nil
		}
		if lerr != nil {
			logrus.WithError(lerr).WithFields(logrus.Fields{
				"path":     path,
				"terminal": row.TerminalID,
				"filename": row.Filename,
			}).Warn("EJ journal locate in file failed")
		}
	}

	return nil, common.ErrEJJournalUnavailable
}

func (s *ejTransactionSearchService) GetJournalFile(
	ctx context.Context,
	id string,
) (*model.EJJournalFileView, error) {
	row, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	path := s.resolveJournalPath(ctx, row)
	if path == "" {
		return nil, common.ErrEJJournalFileUnavailable
	}

	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return nil, common.ErrEJJournalFileUnavailable
	}

	f, err := os.Open(path)
	if err != nil {
		return nil, common.ErrEJJournalFileUnavailable
	}
	defer f.Close()

	size := info.Size()
	readN := size
	truncated := false
	if readN > ejJournalFileMaxBytes {
		readN = ejJournalFileMaxBytes
		truncated = true
	}
	buf := make([]byte, readN)
	n, err := f.Read(buf)
	if err != nil && n == 0 {
		return nil, common.ErrEJJournalFileUnavailable
	}
	buf = buf[:n]
	content := ejparser.NormalizeEJText(string(buf))

	highlightStart := row.LineStart
	highlightEnd := row.LineEnd
	if highlightStart <= 0 {
		// Best-effort locate so the UI can jump near the txn in the full file.
		if located, lerr := ejparser.LocateTransactionBlock(path, ejparser.LocateTip{
			AtmType:    row.AtmType,
			StartTime:  row.StartTime,
			EndTime:    row.EndTime,
			AuthNum:    row.AuthNum,
			CardFirst4: row.CardFirst4,
			CardLast4:  row.CardLast4,
			Amount:     row.Amount,
		}); lerr == nil && located != nil {
			highlightStart = located.LineStart
			highlightEnd = located.LineEnd
		}
	}
	if highlightEnd < highlightStart {
		highlightEnd = highlightStart
	}

	return &model.EJJournalFileView{
		ID:               row.ID.Hex(),
		TerminalID:       row.TerminalID,
		Filename:         row.Filename,
		Path:             path,
		EJDate:           row.EJDate,
		SizeBytes:        size,
		Content:          content,
		Truncated:        truncated,
		HighlightLine:    highlightStart,
		HighlightLineEnd: highlightEnd,
	}, nil
}

func (s *ejTransactionSearchService) OpenJournalDownload(
	ctx context.Context,
	id string,
) (path, downloadName string, err error) {
	row, err := s.GetByID(ctx, id)
	if err != nil {
		return "", "", err
	}
	path = s.resolveJournalPath(ctx, row)
	if path == "" {
		return "", "", common.ErrEJJournalFileUnavailable
	}
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return "", "", common.ErrEJJournalFileUnavailable
	}
	downloadName = strings.TrimSpace(row.Filename)
	if downloadName == "" {
		downloadName = filepath.Base(path)
	}
	if downloadName == "" || downloadName == "." {
		downloadName = "journal.log"
	}
	return path, downloadName, nil
}

func (s *ejTransactionSearchService) resolveJournalPath(
	ctx context.Context,
	row *model.EJTransaction,
) string {
	candidates := make([]string, 0, 4)
	if p := strings.TrimSpace(row.Path); p != "" {
		candidates = append(candidates, p)
	}
	if s.files != nil {
		if reg, err := s.files.Find(ctx, row.TerminalID, row.Filename); err == nil && reg != nil {
			if p := strings.TrimSpace(reg.Path); p != "" {
				candidates = append(candidates, p)
			}
		}
	}
	root := strings.TrimSpace(configs.EJRoot)
	if root != "" && row.TerminalID != "" && row.Filename != "" {
		candidates = append(candidates,
			filepath.Join(root, row.TerminalID, row.Filename),
			filepath.Join(root, row.Filename),
		)
	}

	seen := map[string]struct{}{}
	for _, p := range candidates {
		p = filepath.Clean(p)
		if p == "" || p == "." {
			continue
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p
		}
	}
	return ""
}

func readEJBlockFromFile(path string, offset int64, atmType string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" || offset < 0 {
		return "", os.ErrNotExist
	}
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return "", err
	}
	if offset >= info.Size() {
		return "", os.ErrNotExist
	}

	const maxBlock = 64 * 1024
	remain := info.Size() - offset
	n := remain
	if n > maxBlock {
		n = maxBlock
	}
	buf := make([]byte, n)
	if _, err := f.ReadAt(buf, offset); err != nil {
		return "", err
	}
	data := string(buf)

	endMarker := "============TRANSACTION END============="
	if strings.EqualFold(strings.TrimSpace(atmType), model.EJAtmTypeNCR) {
		endMarker = "TRANSACTION END"
	}
	idx := strings.Index(data, endMarker)
	if idx < 0 {
		return strings.TrimRight(data, "\x00"), nil
	}
	return data[:idx+len(endMarker)], nil
}

func normalizeEJSearchRequest(req model.EJTransactionSearchRequest) model.EJTransactionSearchRequest {
	req.DateFrom = strings.TrimSpace(req.DateFrom)
	req.DateTo = strings.TrimSpace(req.DateTo)
	req.Terminal = strings.ToUpper(strings.TrimSpace(req.Terminal))
	req.AuthNum = strings.TrimSpace(req.AuthNum)
	req.CustomerAccount = strings.TrimSpace(req.CustomerAccount)

	switch strings.ToUpper(strings.TrimSpace(req.Status)) {
	case "SUCCESS", "FAILED":
		req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	default:
		req.Status = ""
	}

	if req.Amount != nil && (math.IsNaN(*req.Amount) || math.IsInf(*req.Amount, 0)) {
		req.Amount = nil
	}

	f4 := strings.TrimSpace(req.CardFirst4)
	l4 := strings.TrimSpace(req.CardLast4)

	// Handler may put the whole card= value into CardFirst4 (masked or compact).
	if f4 != "" && l4 == "" {
		req.CardFirst4, req.CardLast4 = ejparser.CardSearchParts(f4)
		return req
	}

	if f4 != "" {
		req.CardFirst4 = digitsOnly(f4)
		if len(req.CardFirst4) > 4 {
			req.CardFirst4 = req.CardFirst4[:4]
		}
	} else {
		req.CardFirst4 = ""
	}
	if l4 != "" {
		req.CardLast4 = digitsOnly(l4)
		if len(req.CardLast4) > 4 {
			req.CardLast4 = req.CardLast4[len(req.CardLast4)-4:]
		}
	} else {
		req.CardLast4 = ""
	}
	return req
}

func ejSearchHasCriteria(req model.EJTransactionSearchRequest) bool {
	if req.AuthNum != "" {
		return true
	}
	if req.CardFirst4 != "" || req.CardLast4 != "" {
		return true
	}
	if req.DateFrom != "" && req.DateTo != "" {
		return true
	}
	return false
}

func digitsOnly(s string) string {
	var b strings.Builder
	for _, r := range strings.TrimSpace(s) {
		if unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}
