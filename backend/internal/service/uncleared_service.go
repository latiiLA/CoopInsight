package service

import (
	"context"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

const clearingMaxDateRangeDays = 31

const (
	unclearedSourceBinETH = int64(1000000011)
	unclearedDestBinETH   = int64(1000000010)
	unclearedVisaBin      = int64(4)
	unclearedMDSBin       = int64(5)
)

type ClearingPageResult[T any] struct {
	Items    []T  `json:"items"`
	Page     int  `json:"page"`
	PageSize int  `json:"pageSize"`
	HasMore  bool `json:"hasMore"`
}

type UnclearedService interface {
	ListETH(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.UnclearedTransaction], error)
	ListVisa(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.UnclearedTransaction], error)
	ListMastercard(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.UnclearedTransaction], error)
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
	page, pageSize int,
) (ClearingPageResult[model.UnclearedTransaction], error) {
	return s.list(ctx, dateFrom, dateTo, unclearedSourceBinETH, unclearedDestBinETH, page, pageSize)
}

func (s *unclearedService) ListVisa(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.UnclearedTransaction], error) {
	return s.list(ctx, dateFrom, dateTo, unclearedVisaBin, unclearedVisaBin, page, pageSize)
}

func (s *unclearedService) ListMastercard(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.UnclearedTransaction], error) {
	return s.list(ctx, dateFrom, dateTo, unclearedMDSBin, unclearedMDSBin, page, pageSize)
}

func (s *unclearedService) list(
	ctx context.Context,
	dateFrom, dateTo string,
	sourceBin, destBin int64,
	page, pageSize int,
) (ClearingPageResult[model.UnclearedTransaction], error) {
	empty := ClearingPageResult[model.UnclearedTransaction]{
		Items:    []model.UnclearedTransaction{},
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
		rows = []model.UnclearedTransaction{}
	}

	return ClearingPageResult[model.UnclearedTransaction]{
		Items:    rows,
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
	}, nil
}

func parseClearingListArgs(dateFrom, dateTo string, page, pageSize int) (string, string, int, int, error) {
	from, err := parseReportDate(dateFrom)
	if err != nil {
		return "", "", 0, 0, err
	}
	to, err := parseReportDate(dateTo)
	if err != nil {
		return "", "", 0, 0, err
	}

	fromTime, _ := time.Parse("01-02-2006", from)
	toTime, _ := time.Parse("01-02-2006", to)
	if fromTime.After(toTime) {
		return "", "", 0, 0, common.ErrInvalidDateRange
	}
	if toTime.Sub(fromTime).Hours() > float64(clearingMaxDateRangeDays)*24 {
		return "", "", 0, 0, common.ErrDateRangeTooLarge
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 500
	}
	if pageSize > 2000 {
		pageSize = 2000
	}

	return from, to, page, pageSize, nil
}
