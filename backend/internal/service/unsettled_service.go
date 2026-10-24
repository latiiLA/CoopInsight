package service

import (
	"context"
	"strings"
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
	repository     repository.UnsettledRepository
	unclearedRepo  repository.UnclearedRepository
	settlementRepo repository.VisaSettlementRepository
	mastercardIPM  repository.MastercardIPMRepository
}

func NewUnsettledService(
	repository repository.UnsettledRepository,
	settlementRepo repository.VisaSettlementRepository,
	unclearedRepo repository.UnclearedRepository,
	mastercardIPM repository.MastercardIPMRepository,
) UnsettledService {
	return &unsettledService{
		repository:     repository,
		settlementRepo: settlementRepo,
		unclearedRepo:  unclearedRepo,
		mastercardIPM:  mastercardIPM,
	}
}

func (s *unsettledService) ListETH(
	ctx context.Context,
	dateFrom, dateTo string,
	page, pageSize int,
) (ClearingPageResult[model.UnsettledTransaction], error) {
	return s.list(ctx, 210, dateFrom, dateTo, unsettledSourceBinETH, unsettledDestBinETH, page, pageSize)
}

// ListVisa returns unsettled Visa transactions, excluding any whose Oracle
// TR_TRANS_ID already exists as a Visa settlement transaction_id.
//
// Settlement-file transaction_date is derived from the file header / purchase
// MMDD and often does not match Oracle TR_DATE, so exclusion is by id only.
// Matching runs over the full date-range set (up to visaUnsettledMaxPages)
// before paging so settled rows are not left in later pages, and so the same
// search does not return a different subset on each request.
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

	all, hasMoreBeyondCap, listErr := collectUnsettledMatchPages(func(p, ps int) ([]model.UnsettledTransaction, bool, error) {
		return s.repository.List(ctx, 210, from, to, unsettledVisaBin, unsettledVisaBin, p, ps)
	})
	if listErr != nil {
		return empty, listErr
	}

	if s.settlementRepo != nil && len(all) > 0 {
		settledIDs, settledErr := s.settlementRepo.FindSettledTransactionIDsByIDs(ctx, uniqueTxnIDs(all))
		if settledErr != nil {
			return empty, settledErr
		}
		all = excludeSettledByTxnID(all, settledIDs)
	}

	pageRows, hasMore := sliceClearingPage(all, page, pageSize, hasMoreBeyondCap)
	return ClearingPageResult[model.UnsettledTransaction]{
		Items:    pageRows,
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
	}, nil
}

// Cap matching work to the same volume the UI auto-fetches (500 × 20).
// Collect in 2000-row Oracle pages so a typical Visa search is one FETCH of
// the full set; OFFSET windows of 500 were not unique and shuffled each search.
const (
	mastercardMatchMaxPages      = 20
	visaUnsettledMatchLimit      = 10000
	visaUnsettledCollectPageSize = 2000
	visaUnsettledMaxPages        = visaUnsettledMatchLimit / visaUnsettledCollectPageSize
)

// ListMastercard returns Mastercard clearing rows annotated with nearest-day
// IPM settlement amount match status (see mastercard_unsettled_match.go).
// Matching runs over the full date-range set (up to mastercardMatchMaxPages)
// so settlement totals are not double-consumed across auto-fetched pages; the
// requested page is then sliced from that annotated set.
func (s *unsettledService) ListMastercard(
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

	all := make([]model.UnsettledTransaction, 0, pageSize)
	hasMoreBeyondCap := false
	for p := 1; p <= mastercardMatchMaxPages; p++ {
		chunk, more, listErr := s.repository.List(ctx, 210, from, to, unsettledMDSBin, unsettledMDSBin, p, pageSize)
		if listErr != nil {
			return empty, listErr
		}
		if chunk != nil {
			all = append(all, chunk...)
		}
		if !more {
			hasMoreBeyondCap = false
			break
		}
		if p == mastercardMatchMaxPages {
			hasMoreBeyondCap = true
		}
	}

	if s.mastercardIPM != nil && len(all) > 0 {
		start, end := mastercardMatchWindow(from, to, all)
		summaries, ipmErr := s.mastercardIPM.FindSettlementSummariesByDateRange(ctx, start, end)
		if ipmErr != nil {
			// Degrade: still return Oracle clearing with unmatched status.
			for i := range all {
				all[i].MatchStatus = mcMatchStatusUnmatched
				all[i].MatchNote = "IPM settlement register unavailable"
			}
		} else {
			all = annotateMastercardUnsettled(all, summaries)
		}
	} else {
		for i := range all {
			all[i].MatchStatus = mcMatchStatusUnmatched
			all[i].MatchNote = "IPM settlement register unavailable"
		}
	}

	startIdx := (page - 1) * pageSize
	if startIdx > len(all) {
		startIdx = len(all)
	}
	endIdx := startIdx + pageSize
	if endIdx > len(all) {
		endIdx = len(all)
	}
	pageRows := all[startIdx:endIdx]
	hasMore := endIdx < len(all) || hasMoreBeyondCap

	return ClearingPageResult[model.UnsettledTransaction]{
		Items:    pageRows,
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
	}, nil
}

// mastercardMatchWindow expands the search/clearing date range by the
// nearest-day settlement window so D+2 settlement files are included.
func mastercardMatchWindow(dateFrom, dateTo string, rows []model.UnsettledTransaction) (time.Time, time.Time) {
	parse := func(s string) time.Time {
		for _, layout := range []string{"01/02/2006", "01-02-2006", "2006-01-02"} {
			if t, err := time.Parse(layout, s); err == nil {
				return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
			}
		}
		return time.Time{}
	}

	start := parse(dateFrom)
	end := parse(dateTo)
	for _, r := range rows {
		d := parseOracleDate(firstNonEmpty(r.TxnDate, r.Date))
		if d.IsZero() {
			continue
		}
		d = time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, time.UTC)
		if start.IsZero() || d.Before(start) {
			start = d
		}
		if end.IsZero() || d.After(end) {
			end = d
		}
	}
	if start.IsZero() {
		start = time.Now().UTC().Truncate(24 * time.Hour)
	}
	if end.IsZero() || end.Before(start) {
		end = start
	}
	end = end.AddDate(0, 0, mcSettlementMatchWindowDays)
	return start, end
}

// ListVisaCybersource returns unsettled Visa Cybersource transactions.
// It fetches uncleared transactions (TR_POSTED = 0) and excludes any whose
// TR_TRANS_ID already exists in the Visa settlement register (id only — see ListVisa).
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

	all, hasMoreBeyondCap, listErr := collectUnsettledMatchPages(func(p, ps int) ([]model.UnsettledTransaction, bool, error) {
		unclearedRows, more, err := s.unclearedRepo.List(ctx, 230, from, to, 408158, 9444444444, p, ps)
		if err != nil {
			return nil, false, err
		}
		out := make([]model.UnsettledTransaction, 0, len(unclearedRows))
		for _, u := range unclearedRows {
			out = append(out, unclearedToUnsettled(u))
		}
		return out, more, nil
	})
	if listErr != nil {
		return empty, listErr
	}

	if s.settlementRepo != nil && len(all) > 0 {
		settledIDs, settledErr := s.settlementRepo.FindSettledTransactionIDsByIDs(ctx, uniqueTxnIDs(all))
		if settledErr != nil {
			return empty, settledErr
		}
		all = excludeSettledByTxnID(all, settledIDs)
	}

	pageRows, hasMore := sliceClearingPage(all, page, pageSize, hasMoreBeyondCap)
	return ClearingPageResult[model.UnsettledTransaction]{
		Items:    pageRows,
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
	}, nil
}

func unclearedToUnsettled(u model.UnclearedTransaction) model.UnsettledTransaction {
	return model.UnsettledTransaction{
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
		SettlementAmount:   u.SettlementAmount,
		SettlementCurrency: u.SettlementCurrency,
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

func collectUnsettledMatchPages(
	list func(page, pageSize int) ([]model.UnsettledTransaction, bool, error),
) ([]model.UnsettledTransaction, bool, error) {
	all := make([]model.UnsettledTransaction, 0, visaUnsettledCollectPageSize)
	hasMoreBeyondCap := false
	for p := 1; p <= visaUnsettledMaxPages; p++ {
		chunk, more, err := list(p, visaUnsettledCollectPageSize)
		if err != nil {
			return nil, false, err
		}
		if chunk != nil {
			all = append(all, chunk...)
		}
		if !more {
			return all, false, nil
		}
		if p == visaUnsettledMaxPages {
			hasMoreBeyondCap = true
		}
	}
	return all, hasMoreBeyondCap, nil
}

func uniqueTxnIDs(rows []model.UnsettledTransaction) []string {
	seen := make(map[string]struct{}, len(rows))
	ids := make([]string, 0, len(rows))
	for _, r := range rows {
		id := strings.TrimSpace(r.TxnID)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	return ids
}

func excludeSettledByTxnID(rows []model.UnsettledTransaction, settledIDs []string) []model.UnsettledTransaction {
	if len(settledIDs) == 0 {
		return rows
	}
	settled := make(map[string]struct{}, len(settledIDs))
	for _, id := range settledIDs {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		settled[id] = struct{}{}
	}
	filtered := make([]model.UnsettledTransaction, 0, len(rows))
	for _, r := range rows {
		if _, ok := settled[strings.TrimSpace(r.TxnID)]; ok {
			continue
		}
		filtered = append(filtered, r)
	}
	return filtered
}

func sliceClearingPage[T any](all []T, page, pageSize int, hasMoreBeyondCap bool) ([]T, bool) {
	startIdx := (page - 1) * pageSize
	if startIdx < 0 {
		startIdx = 0
	}
	if startIdx > len(all) {
		startIdx = len(all)
	}
	endIdx := startIdx + pageSize
	if endIdx > len(all) {
		endIdx = len(all)
	}
	return all[startIdx:endIdx], endIdx < len(all) || hasMoreBeyondCap
}

// parseOracleDate parses a date string from Oracle (YYYY-MM-DD) to time.Time.
func parseOracleDate(dateStr string) time.Time {
	t, _ := time.Parse("2006-01-02", dateStr)
	return t
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
