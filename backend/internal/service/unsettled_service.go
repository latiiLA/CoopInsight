package service

import (
	"context"
	"time"

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
	ListVisaCybersource(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (ClearingPageResult[model.UnsettledTransaction], error)
}

type unsettledService struct {
	repository    repository.UnsettledRepository
	unclearedRepo repository.UnclearedRepository
	settlementRepo repository.VisaSettlementRepository
}

func NewUnsettledService(repository repository.UnsettledRepository, settlementRepo repository.VisaSettlementRepository, unclearedRepo repository.UnclearedRepository) UnsettledService {
	return &unsettledService{repository: repository, settlementRepo: settlementRepo, unclearedRepo: unclearedRepo}
}

func (s *unsettledService) ListETH(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.UnsettledTransaction], error) {
	return s.list(ctx, 210, dateFrom, dateTo, unsettledSourceBinETH, unsettledDestBinETH, page, pageSize)
}

// ListVisa returns unsettled Visa transactions, excluding any that have already
// been settled. Matching is done on both:
//   - txnId (Oracle TR_TRANS_ID) = transaction_id (MongoDB)
//   - txnDate (Oracle TR_DATE) = transaction_date (MongoDB)
func (s *unsettledService) ListVisa(
	ctx context.Context,
	dateFrom, dateTo string,
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

	// Fetch unsettled transactions from Oracle (no SQL-level exclusion)
	rows, hasMore, err := s.repository.List(ctx, 210, from, to, unsettledVisaBin, unsettledVisaBin, page, pageSize)
	if err != nil {
		return empty, err
	}
	if rows == nil {
		rows = []model.UnsettledTransaction{}
	}

	// Filter out settled transactions by matching txnId = transaction_id
	// AND txnDate = transaction_date
	if s.settlementRepo != nil && len(rows) > 0 {
		// Extract unique txnIds
		txnIDSet := make(map[string]struct{})
		for _, r := range rows {
			if r.TxnID != "" {
				txnIDSet[r.TxnID] = struct{}{}
			}
		}
		txnIDs := make([]string, 0, len(txnIDSet))
		for id := range txnIDSet {
			txnIDs = append(txnIDs, id)
		}

		// Fetch matching settlement records
		settledRecords, err := s.settlementRepo.FindSettledTransactionsByIDs(ctx, txnIDs)
		if err != nil {
			return empty, err
		}

		// Build a map of settled txnId -> transaction_date
		settledMap := make(map[string]time.Time)
		for _, rec := range settledRecords {
			settledMap[rec.TransactionID] = rec.TransactionDate
		}

		// Filter out transactions whose txnId AND txnDate both match settlement
		filtered := make([]model.UnsettledTransaction, 0, len(rows))
		for _, r := range rows {
			if settledDate, ok := settledMap[r.TxnID]; ok {
				// Check if dates match (same year, month, day)
				if !isSameDate(parseOracleDate(r.TxnDate), settledDate) {
					filtered = append(filtered, r)
				}
				// else: settled, skip it
			} else {
				filtered = append(filtered, r)
			}
		}
		rows = filtered
	}

	return ClearingPageResult[model.UnsettledTransaction]{
		Items:    rows,
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
	}, nil
}

func (s *unsettledService) ListMastercard(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.UnsettledTransaction], error) {
	return s.list(ctx, 210, dateFrom, dateTo, unsettledMDSBin, unsettledMDSBin, page, pageSize)
}

// ListVisaCybersource returns unsettled Visa Cybersource transactions.
// It fetches uncleared transactions (TR_POSTED = 0) and excludes any that
// have already been settled. Matching is done on both:
//   - txnId (Oracle TR_TRANS_ID) = transaction_id (MongoDB)
//   - txnDate (Oracle TR_DATE) = transaction_date (MongoDB)
func (s *unsettledService) ListVisaCybersource(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.UnsettledTransaction], error) {
	empty := ClearingPageResult[model.UnsettledTransaction]{
		Items:    []model.UnsettledTransaction{},
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

	// Fetch uncleared transactions from Oracle
	unclearedRows, hasMore, err := s.unclearedRepo.List(ctx, 230, from, to, 408158, 9444444444, page, pageSize)
	if err != nil {
		return empty, err
	}

	// Convert to UnsettledTransaction
	converted := make([]model.UnsettledTransaction, 0, len(unclearedRows))
	for _, u := range unclearedRows {
		converted = append(converted, model.UnsettledTransaction(u))
	}

	// Filter out settled transactions by matching txnId = transaction_id
	// AND txnDate = transaction_date
	if s.settlementRepo != nil && len(converted) > 0 {
		// Extract unique txnIds
		txnIDSet := make(map[string]struct{})
		for _, u := range unclearedRows {
			if u.TxnID != "" {
				txnIDSet[u.TxnID] = struct{}{}
			}
		}
		txnIDs := make([]string, 0, len(txnIDSet))
		for id := range txnIDSet {
			txnIDs = append(txnIDs, id)
		}

		// Fetch matching settlement records
		settledRecords, err := s.settlementRepo.FindSettledTransactionsByIDs(ctx, txnIDs)
		if err != nil {
			return empty, err
		}

		// Build a map of settled txnId -> transaction_date
		settledMap := make(map[string]time.Time)
		for _, rec := range settledRecords {
			settledMap[rec.TransactionID] = rec.TransactionDate
		}

		// Filter out transactions whose txnId AND txnDate both match settlement
		filtered := make([]model.UnsettledTransaction, 0, len(converted))
		for i, u := range converted {
			unclearedTxnDate := parseOracleDate(unclearedRows[i].TxnDate)
			if settledDate, ok := settledMap[unclearedRows[i].TxnID]; ok {
				// Check if dates match (same year, month, day)
				if !isSameDate(unclearedTxnDate, settledDate) {
					filtered = append(filtered, u)
				}
				// else: settled, skip it
			} else {
				filtered = append(filtered, u)
			}
		}
		converted = filtered
	}

	return ClearingPageResult[model.UnsettledTransaction]{
		Items:    converted,
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
	}, nil
}



// parseOracleDate parses a date string from Oracle (YYYY-MM-DD) to time.Time.
func parseOracleDate(dateStr string) time.Time {
	t, _ := time.Parse("2006-01-02", dateStr)
	return t
}

// isSameDate checks if two dates fall on the same calendar day.
func isSameDate(a, b time.Time) bool {
	return a.Year() == b.Year() && a.Month() == b.Month() && a.Day() == b.Day()
}

func (s *unsettledService) list(
	ctx context.Context,
	msgtype int64,
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

	rows, hasMore, err := s.repository.List(ctx, msgtype, from, to, sourceBin, destBin, page, pageSize)
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
