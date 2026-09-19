package service

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

const (
	settledSourceBinETH = int64(1000000011)
	settledDestBinETH   = int64(1000000010)
	settledVisaBin      = int64(4)
	settledMDSBin       = int64(5)
)

type SettledService interface {
	ListETH(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.SettledTransaction], error)
	ListVisa(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.SettledTransaction], error)
	ListMastercard(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.SettledTransaction], error)
}

type settledService struct {
	repository repository.SettledRepository
}

func NewSettledService(repository repository.SettledRepository) SettledService {
	return &settledService{repository: repository}
}

func (s *settledService) ListETH(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.SettledTransaction], error) {
	return s.list(ctx, dateFrom, dateTo, settledSourceBinETH, settledDestBinETH, page, pageSize)
}

func (s *settledService) ListVisa(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.SettledTransaction], error) {
	return s.list(ctx, dateFrom, dateTo, settledVisaBin, settledVisaBin, page, pageSize)
}

func (s *settledService) ListMastercard(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.SettledTransaction], error) {
	return s.list(ctx, dateFrom, dateTo, settledMDSBin, settledMDSBin, page, pageSize)
}

func (s *settledService) list(
	ctx context.Context,
	dateFrom, dateTo string,
	sourceBin, destBin int64,
	page, pageSize int,
) (ClearingPageResult[model.SettledTransaction], error) {
	empty := ClearingPageResult[model.SettledTransaction]{
		Items:    []model.SettledTransaction{},
		Page:     page,
		PageSize: pageSize,
	}

	if s.repository == nil {
		return empty, common.ErrOracleUnavailable
	}

	from, to, page, pageSize, err := parseClearingListArgs(dateFrom, dateTo, page, pageSize)
	if err != nil {
		return empty, err
	}
	empty.Page, empty.PageSize = page, pageSize

	rows, hasMore, err := s.repository.List(ctx, from, to, sourceBin, destBin, page, pageSize)
	if err != nil {
		return empty, err
	}
	if rows == nil {
		rows = []model.SettledTransaction{}
	}

	return ClearingPageResult[model.SettledTransaction]{
		Items:    rows,
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
	}, nil
}
