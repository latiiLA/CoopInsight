package service

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/latiiLA/CoopInsight/backend/configs"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"github.com/latiiLA/CoopInsight/backend/internal/service/ejparser"
)

// EJBrowseService lists indexed journals by terminal and opens whole EJ files.
// Separate from transaction search so Finder stays unchanged.
type EJBrowseService interface {
	ListTerminals(ctx context.Context, dateFrom, dateTo string) ([]model.EJBrowseTerminal, error)
	ListFiles(ctx context.Context, terminalID, dateFrom, dateTo string) ([]model.EJBrowseFile, error)
	GetJournalFile(ctx context.Context, terminalID, filename string) (*model.EJJournalFileView, error)
	OpenJournalDownload(ctx context.Context, terminalID, filename string) (path, downloadName string, err error)
}

type ejBrowseService struct {
	files repository.EJFileRepository
}

func NewEJBrowseService(files repository.EJFileRepository) EJBrowseService {
	return &ejBrowseService{files: files}
}

func (s *ejBrowseService) ListTerminals(
	ctx context.Context,
	dateFrom, dateTo string,
) ([]model.EJBrowseTerminal, error) {
	if s == nil || s.files == nil {
		return nil, common.ErrEJSearchUnavailable
	}
	rows, err := s.files.ListTerminalSummaries(ctx, dateFrom, dateTo)
	if err != nil {
		return nil, err
	}
	if rows == nil {
		return []model.EJBrowseTerminal{}, nil
	}
	return rows, nil
}

func (s *ejBrowseService) ListFiles(
	ctx context.Context,
	terminalID, dateFrom, dateTo string,
) ([]model.EJBrowseFile, error) {
	if s == nil || s.files == nil {
		return nil, common.ErrEJSearchUnavailable
	}
	rows, err := s.files.ListFilesByTerminal(ctx, terminalID, dateFrom, dateTo)
	if err != nil {
		return nil, err
	}
	if rows == nil {
		return []model.EJBrowseFile{}, nil
	}
	return rows, nil
}

func (s *ejBrowseService) GetJournalFile(
	ctx context.Context,
	terminalID, filename string,
) (*model.EJJournalFileView, error) {
	path, name, err := s.resolvePath(ctx, terminalID, filename)
	if err != nil {
		return nil, err
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
	content := ejparser.NormalizeEJText(string(buf[:n]))
	ejDate, _, _ := ejparser.ParseFilename(name)

	return &model.EJJournalFileView{
		ID:         strings.ToUpper(strings.TrimSpace(terminalID)) + "/" + name,
		TerminalID: strings.ToUpper(strings.TrimSpace(terminalID)),
		Filename:   name,
		Path:       path,
		EJDate:     ejDate,
		SizeBytes:  size,
		Content:    content,
		Truncated:  truncated,
	}, nil
}

func (s *ejBrowseService) OpenJournalDownload(
	ctx context.Context,
	terminalID, filename string,
) (path, downloadName string, err error) {
	return s.resolvePath(ctx, terminalID, filename)
}

func (s *ejBrowseService) resolvePath(
	ctx context.Context,
	terminalID, filename string,
) (path, downloadName string, err error) {
	if s == nil || s.files == nil {
		return "", "", common.ErrEJSearchUnavailable
	}
	terminalID = strings.ToUpper(strings.TrimSpace(terminalID))
	filename = filepath.Base(strings.TrimSpace(filename))
	if terminalID == "" {
		return "", "", common.ErrInvalidTerminalID
	}
	if filename == "" || filename == "." || filename == ".." {
		return "", "", common.ErrEJJournalFileUnavailable
	}

	reg, err := s.files.Find(ctx, terminalID, filename)
	if err != nil {
		return "", "", err
	}

	candidates := make([]string, 0, 3)
	if reg != nil {
		if p := strings.TrimSpace(reg.Path); p != "" {
			candidates = append(candidates, p)
		}
	}
	root := strings.TrimSpace(configs.EJRoot)
	if root != "" {
		candidates = append(candidates, filepath.Join(root, terminalID, filename))
		candidates = append(candidates, filepath.Join(root, filename))
	}

	for _, candidate := range candidates {
		info, sterr := os.Stat(candidate)
		if sterr == nil && !info.IsDir() {
			return candidate, filename, nil
		}
	}
	return "", "", common.ErrEJJournalFileUnavailable
}
