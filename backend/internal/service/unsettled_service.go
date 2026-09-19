package service

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

const (
	unsettledSourceBinETH = int64(1000000011)
	unsettledDestBinETH   = int64(1000000010)
	unsettledVisaBin      = int64(4)
	unsettledMDSBin       = int64(5)
)

type UnsettledService interface {
	ListETH(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.UnsettledTransaction], error)
	ListVisa(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.UnsettledTransaction], error)
	ListMastercard(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.UnsettledTransaction], error)
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
	page, pageSize int,
) (ClearingPageResult[model.UnsettledTransaction], error) {
	return s.list(ctx, dateFrom, dateTo, unsettledSourceBinETH, unsettledDestBinETH, page, pageSize)
}

func (s *unsettledService) ListVisa(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.UnsettledTransaction], error) {
	return s.list(ctx, dateFrom, dateTo, unsettledVisaBin, unsettledVisaBin, page, pageSize)
}

func (s *unsettledService) ListMastercard(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.UnsettledTransaction], error) {
	return s.list(ctx, dateFrom, dateTo, unsettledMDSBin, unsettledMDSBin, page, pageSize)
}

func (s *unsettledService) list(
	ctx context.Context,
	dateFrom, dateTo string,
	sourceBin, destBin int64,
	page, pageSize int,
) (ClearingPageResult[model.UnsettledTransaction], error) {
	empty := ClearingPageResult[model.UnsettledTransaction]{
		Items:    []model.UnsettledTransaction{},
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
		rows = []model.UnsettledTransaction{}
	}

	return ClearingPageResult[model.UnsettledTransaction]{
		Items:    rows,
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
	}, nil
}
