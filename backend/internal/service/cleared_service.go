package service

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

const (
	clearedSourceBinETH = int64(1000000011)
	clearedDestBinETH   = int64(1000000010)
	clearedVisaBin      = int64(4)
	clearedMDSBin       = int64(5)
)

type ClearedService interface {
	ListETH(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.ClearedTransaction], error)
	ListVisa(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.ClearedTransaction], error)
	ListMastercard(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.ClearedTransaction], error)
}

type clearedService struct {
	repository repository.ClearedRepository
}

func NewClearedService(repository repository.ClearedRepository) ClearedService {
	return &clearedService{repository: repository}
}

func (s *clearedService) ListETH(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.ClearedTransaction], error) {
	return s.list(ctx, dateFrom, dateTo, clearedSourceBinETH, clearedDestBinETH, page, pageSize)
}

func (s *clearedService) ListVisa(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.ClearedTransaction], error) {
	return s.list(ctx, dateFrom, dateTo, clearedVisaBin, clearedVisaBin, page, pageSize)
}

func (s *clearedService) ListMastercard(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.ClearedTransaction], error) {
	return s.list(ctx, dateFrom, dateTo, clearedMDSBin, clearedMDSBin, page, pageSize)
}

func (s *clearedService) list(
	ctx context.Context,
	dateFrom, dateTo string,
	sourceBin, destBin int64,
	page, pageSize int,
) (ClearingPageResult[model.ClearedTransaction], error) {
	empty := ClearingPageResult[model.ClearedTransaction]{
		Items:    []model.ClearedTransaction{},
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
		rows = []model.ClearedTransaction{}
	}

	return ClearingPageResult[model.ClearedTransaction]{
		Items:    rows,
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
	}, nil
}
