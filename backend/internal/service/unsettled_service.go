package service

import (
	"context"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

type UnsettledService interface {
	ListETH(ctx context.Context, dateFrom, dateTo string) ([]model.UnsettledTransaction, error)
}

type unsettledService struct {
	repository repository.UnsettledRepository
}

func NewUnsettledService(repository repository.UnsettledRepository) UnsettledService {
	return &unsettledService{repository: repository}
}

func (s *unsettledService) ListETH(
	ctx context.Context,
	dateFrom, dateTo string,
) ([]model.UnsettledTransaction, error) {
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

	rows, err := s.repository.ListETH(ctx, from, to)
	if err != nil {
		return nil, err
	}
	if rows == nil {
		return []model.UnsettledTransaction{}, nil
	}

	return rows, nil
}
