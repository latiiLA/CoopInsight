package service

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

const (
	clearedSourceBinETH             = int64(1000000011)
	clearedDestBinETH               = int64(1000000010)
	clearedVisaBin                  = int64(4)
	clearedMDSBin                   = int64(5)
	clearedVisaCybersourceSourceBin = int64(408158)
	clearedVisaCybersourceBin       = int64(9444444444)
)

type ClearedService interface {
	ListETH(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.ClearedTransaction], error)
	ListVisa(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.ClearedTransaction], error)
	ListVisaCybersource(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.ClearedTransaction], error)
	ListMastercard(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.ClearedTransaction], error)
}

type clearedService struct {
	repository    repository.ClearedRepository
	unclearedRepo repository.UnclearedRepository
}

func NewClearedService(
	repository repository.ClearedRepository,
	unclearedRepo repository.UnclearedRepository,
) ClearedService {
	return &clearedService{repository: repository, unclearedRepo: unclearedRepo}
}

func (s *clearedService) ListETH(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.ClearedTransaction], error) {
	return s.list(ctx, 210, dateFrom, dateTo, clearedSourceBinETH, clearedDestBinETH, page, pageSize)
}

func (s *clearedService) ListVisa(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.ClearedTransaction], error) {
	return s.list(ctx, 210, dateFrom, dateTo, clearedVisaBin, clearedVisaBin, page, pageSize)
}

func (s *clearedService) ListMastercard(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.ClearedTransaction], error) {
	return s.list(ctx, 210, dateFrom, dateTo, clearedMDSBin, clearedMDSBin, page, pageSize)
}

// ListVisaCybersource returns Oracle Cybersource rows with TR_SETTLE = 0.
// Same UnclearedRepository fetch as Uncleared / Unsettled VISA Cybersource
// (msg 230, bins 408158 / 9444444444, RRN dedup). It does not consult the
// Visa settlement register.
func (s *clearedService) ListVisaCybersource(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.ClearedTransaction], error) {
	empty := ClearingPageResult[model.ClearedTransaction]{
		Items:    []model.ClearedTransaction{},
		Page:     page,
		PageSize: pageSize,
	}

	if s.unclearedRepo == nil {
		return empty, common.ErrOracleUnavailable
	}

	from, to, page, pageSize, err := parseClearingListArgs(dateFrom, dateTo, page, pageSize)
	if err != nil {
		return empty, err
	}
	empty.Page, empty.PageSize = page, pageSize

	rows, hasMore, err := s.unclearedRepo.List(
		ctx,
		230,
		from,
		to,
		clearedVisaCybersourceSourceBin,
		clearedVisaCybersourceBin,
		page,
		pageSize,
	)
	if err != nil {
		return empty, err
	}

	items := make([]model.ClearedTransaction, 0, len(rows))
	for _, row := range rows {
		items = append(items, unclearedToCleared(row))
	}

	return ClearingPageResult[model.ClearedTransaction]{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
	}, nil
}

func unclearedToCleared(u model.UnclearedTransaction) model.ClearedTransaction {
	return model.ClearedTransaction{
		ID:             u.ID,
		Date:           u.Date,
		TxnDate:        u.TxnDate,
		Time:           u.Time,
		MsgType:        u.MsgType,
		ProcCode:       u.ProcCode,
		RRN:            u.RRN,
		STAN:           u.STAN,
		RespCode:       u.RespCode,
		Amount:         u.Amount,
		Currency:       u.Currency,
		TerminalID:     u.TerminalID,
		Merchant:       u.Merchant,
		CardProduct:    u.CardProduct,
		TxnSource:      u.TxnSource,
		TxnDest:        u.TxnDest,
		IssuerAcquirer: u.IssuerAcquirer,
		PosAtm:         u.PosAtm,
		TxnID:          u.TxnID,
	}
}

func (s *clearedService) list(
	ctx context.Context,
	msgType int64,
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

	rows, hasMore, err := s.repository.List(ctx, msgType, from, to, sourceBin, destBin, page, pageSize)
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
