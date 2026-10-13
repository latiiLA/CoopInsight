package service

import (
	"context"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

const safListDefaultLimit = 5000

type SafService interface {
	Summary(ctx context.Context, from, to time.Time) (*model.SafSummary, error)
	ListByRange(ctx context.Context, from, to time.Time, status string) ([]model.SafTransaction, error)
}

type safService struct {
	repository repository.SafRepository
}

func NewSafService(repository repository.SafRepository) SafService {
	return &safService{repository: repository}
}

func (s *safService) Summary(ctx context.Context, from, to time.Time) (*model.SafSummary, error) {
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}
	from, to, err := normalizeSafRange(from, to)
	if err != nil {
		return nil, err
	}
	summary, err := s.repository.Summary(ctx, from, to)
	if err != nil {
		return nil, err
	}
	if summary == nil {
		return &model.SafSummary{
			DateFrom: from.Format("2006-01-02"),
			DateTo:   to.Format("2006-01-02"),
			AsOf:     time.Now().UTC(),
		}, nil
	}
	return summary, nil
}

func (s *safService) ListByRange(
	ctx context.Context,
	from, to time.Time,
	status string,
) ([]model.SafTransaction, error) {
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}
	from, to, err := normalizeSafRange(from, to)
	if err != nil {
		return nil, err
	}
	status = strings.ToUpper(strings.TrimSpace(status))
	if status == "" {
		status = "S"
	}

	rows, err := s.repository.ListByRange(ctx, from, to, status, safListDefaultLimit)
	if err != nil {
		return nil, err
	}
	if rows == nil {
		return []model.SafTransaction{}, nil
	}
	return rows, nil
}

func normalizeSafRange(from, to time.Time) (time.Time, time.Time, error) {
	from = truncateDay(from)
	to = truncateDay(to)
	if from.After(to) {
		return time.Time{}, time.Time{}, common.ErrInvalidDateRange
	}
	return from, to, nil
}

func truncateDay(day time.Time) time.Time {
	y, m, d := day.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}
