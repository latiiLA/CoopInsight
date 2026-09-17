package service

import (
	"context"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

// Scheme BIN pairs for uncleared lists (not card product).
const (
	unclearedSourceBinETH = int64(1000000011)
	unclearedDestBinETH   = int64(1000000010)
	unclearedVisaBin      = int64(4)
	unclearedMDSBin       = int64(5)
)

type UnclearedService interface {
	ListETH(ctx context.Context, dateFrom, dateTo string) ([]model.UnclearedTransaction, error)
	ListVisa(ctx context.Context, dateFrom, dateTo string) ([]model.UnclearedTransaction, error)
	ListMastercard(ctx context.Context, dateFrom, dateTo string) ([]model.UnclearedTransaction, error)
}

type unclearedService struct {
	repository repository.UnclearedRepository
}

func NewUnclearedService(repository repository.UnclearedRepository) UnclearedService {
	return &unclearedService{repository: repository}
}

func (s *unclearedService) ListETH(
	ctx context.Context,
	dateFrom, dateTo string,
) ([]model.UnclearedTransaction, error) {
	return s.list(ctx, dateFrom, dateTo, unclearedSourceBinETH, unclearedDestBinETH)
}

func (s *unclearedService) ListVisa(
	ctx context.Context,
	dateFrom, dateTo string,
) ([]model.UnclearedTransaction, error) {
	return s.list(ctx, dateFrom, dateTo, unclearedVisaBin, unclearedVisaBin)
}

func (s *unclearedService) ListMastercard(
	ctx context.Context,
	dateFrom, dateTo string,
) ([]model.UnclearedTransaction, error) {
	return s.list(ctx, dateFrom, dateTo, unclearedMDSBin, unclearedMDSBin)
}

func (s *unclearedService) list(
	ctx context.Context,
	dateFrom, dateTo string,
	sourceBin, destBin int64,
) ([]model.UnclearedTransaction, error) {
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

	rows, err := s.repository.List(ctx, from, to, sourceBin, destBin)
	if err != nil {
		return nil, err
	}
	if rows == nil {
		return []model.UnclearedTransaction{}, nil
	}

	return rows, nil
}
