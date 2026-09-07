package service

import (
	"context"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

type EbirrCardlessWithdrawalService interface {
	GetReport(ctx context.Context, dateFrom, dateTo string) ([]model.EbirrCardlessWithdrawal, error)
}

type ebirrCardlessWithdrawalService struct {
	repository repository.EbirrCardlessWithdrawalRepository
}

func NewEbirrCardlessWithdrawalService(
	repository repository.EbirrCardlessWithdrawalRepository,
) EbirrCardlessWithdrawalService {
	return &ebirrCardlessWithdrawalService{
		repository: repository,
	}
}

func (s *ebirrCardlessWithdrawalService) GetReport(
	ctx context.Context,
	dateFrom, dateTo string,
) ([]model.EbirrCardlessWithdrawal, error) {
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

	rows, err := s.repository.GetReport(ctx, from, to)
	if err != nil {
		return nil, err
	}

	if rows == nil {
		return []model.EbirrCardlessWithdrawal{}, nil
	}

	return rows, nil
}
