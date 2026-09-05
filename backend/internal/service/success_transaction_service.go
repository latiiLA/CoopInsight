package service

import (
	"context"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

type SuccessTransactionService interface {
	GetReport(ctx context.Context, dateFrom, dateTo string) (*model.SuccessTransactionReport, error)
}

type successTransactionService struct {
	repository repository.SuccessTransactionRepository
}

func NewSuccessTransactionService(repository repository.SuccessTransactionRepository) SuccessTransactionService {
	return &successTransactionService{
		repository: repository,
	}
}

func (s *successTransactionService) GetReport(ctx context.Context, dateFrom, dateTo string) (*model.SuccessTransactionReport, error) {
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}

	from, err := parseReportDate(dateFrom)
	if err != nil {
		return nil, err
	}

	to, err := parseReportDate(dateTo)
	if err != nil {
		return nil, err
	}

	fromTime, _ := time.Parse("01-02-2006", from)
	toTime, _ := time.Parse("01-02-2006", to)

	if fromTime.After(toTime) {
		return nil, common.ErrInvalidDateRange
	}

	return s.repository.GetReport(ctx, from, to)
}

func parseReportDate(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", common.ErrInvalidReportDate
	}

	layouts := []string{"01-02-2006", "01/02/2006"}
	for _, layout := range layouts {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			return parsed.Format("01-02-2006"), nil
		}
	}

	return "", common.ErrInvalidReportDate
}
