package service

import (
	"context"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

type SwitchTransactionSearchService interface {
	Search(
		ctx context.Context,
		req model.SwitchTransactionSearchRequest,
		page, pageSize int,
	) (*model.SwitchTransactionSearchResult, error)
	GetByRowID(ctx context.Context, rowID string) (*model.SwitchTransactionDetail, error)
}

type switchTransactionSearchService struct {
	repository repository.SwitchTransactionSearchRepository
}

func NewSwitchTransactionSearchService(
	repository repository.SwitchTransactionSearchRepository,
) SwitchTransactionSearchService {
	return &switchTransactionSearchService{repository: repository}
}

// Undated card/RRN/trace lookups run in short windows so the first page returns
// quickly; the UI can request older windows afterward.
const (
	// Short first window so card MASK_PAN lookups return before the HTTP timeout.
	switchTxnLookupWindowDays = 7
	switchTxnLookupMaxMonths  = 24
)

func (s *switchTransactionSearchService) Search(
	ctx context.Context,
	req model.SwitchTransactionSearchRequest,
	page, pageSize int,
) (*model.SwitchTransactionSearchResult, error) {
	req, page, pageSize, windowed, err := parseSwitchTxnSearchArgs(req, page, pageSize)
	if err != nil {
		return nil, err
	}
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}
	result, err := s.repository.Search(ctx, req, page, pageSize)
	if err != nil {
		return nil, err
	}
	if result == nil {
		return nil, nil
	}
	result.DateFrom = req.DateFrom
	result.DateTo = req.DateTo
	result.HasMoreOlder = windowed && switchTxnCanExtendOlder(req.DateFrom)
	return result, nil
}

func (s *switchTransactionSearchService) GetByRowID(
	ctx context.Context,
	rowID string,
) (*model.SwitchTransactionDetail, error) {
	rowID = strings.TrimSpace(rowID)
	if rowID == "" {
		return nil, common.ErrInvalidSwitchRowID
	}
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}
	return s.repository.GetByRowID(ctx, rowID)
}

func parseSwitchTxnSearchArgs(
	req model.SwitchTransactionSearchRequest,
	page, pageSize int,
) (model.SwitchTransactionSearchRequest, int, int, bool, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 100
	}
	if pageSize > 500 {
		pageSize = 500
	}

	req.Product = strings.TrimSpace(req.Product)
	req.Q = strings.TrimSpace(req.Q)
	req.RRN = strings.TrimSpace(req.RRN)
	req.Card = strings.TrimSpace(req.Card)
	req.Merchant = strings.TrimSpace(req.Merchant)
	req.Terminal = strings.TrimSpace(req.Terminal)
	req.TxnCode = strings.TrimSpace(req.TxnCode)
	req.Trace = strings.TrimSpace(req.Trace)
	req.Account = strings.TrimSpace(req.Account)
	req.ApprovalCode = strings.TrimSpace(req.ApprovalCode)
	req.RspCode = strings.TrimSpace(req.RspCode)
	req.IssuerCurrency = strings.TrimSpace(req.IssuerCurrency)
	req.AcquirerCurrency = strings.TrimSpace(req.AcquirerCurrency)
	req.MCC = strings.TrimSpace(req.MCC)
	req.AcquiringCountry = strings.TrimSpace(req.AcquiringCountry)
	req.Acquirer = strings.TrimSpace(req.Acquirer)
	req.RouteID = strings.TrimSpace(req.RouteID)
	req.RouteMatch = strings.ToLower(strings.TrimSpace(req.RouteMatch))
	req.Channel = strings.ToLower(strings.TrimSpace(req.Channel))
	req.MsgType = strings.TrimSpace(req.MsgType)
	req.Result = strings.ToLower(strings.TrimSpace(req.Result))
	req.Reversal = strings.ToLower(strings.TrimSpace(req.Reversal))

	switch req.RouteMatch {
	case "", "source", "dest", "either":
		if req.RouteMatch == "" && req.RouteID != "" {
			req.RouteMatch = "either"
		}
	default:
		req.RouteMatch = "either"
	}
	switch req.Channel {
	case "", "atm", "pos":
	default:
		req.Channel = ""
	}
	switch req.Result {
	case "", "approved", "declined":
	default:
		req.Result = ""
	}
	switch req.Reversal {
	case "", "exclude", "only":
	default:
		req.Reversal = ""
	}

	hasLookupKey := req.RRN != "" || req.Card != "" || req.Trace != ""

	dateFrom := strings.TrimSpace(req.DateFrom)
	dateTo := strings.TrimSpace(req.DateTo)
	if dateFrom == "" && dateTo == "" {
		if !hasLookupKey {
			return req, page, pageSize, false, common.ErrSwitchTxnSearchNeedsCriteria
		}
		// First undated lookup: short window only (not 24 months).
		to := time.Now().UTC().Truncate(24 * time.Hour)
		from := to.AddDate(0, 0, -(switchTxnLookupWindowDays - 1))
		floor := switchTxnLookupFloor(to)
		if from.Before(floor) {
			from = floor
		}
		req.DateFrom = from.Format("01-02-2006")
		req.DateTo = to.Format("01-02-2006")
		return req, page, pageSize, true, nil
	}
	if dateFrom == "" || dateTo == "" {
		return req, page, pageSize, false, common.ErrInvalidReportDate
	}

	from, err := parseReportDate(dateFrom)
	if err != nil {
		return req, page, pageSize, false, err
	}
	to, err := parseReportDate(dateTo)
	if err != nil {
		return req, page, pageSize, false, err
	}
	fromTime, _ := time.Parse("01-02-2006", from)
	toTime, _ := time.Parse("01-02-2006", to)
	if fromTime.After(toTime) {
		return req, page, pageSize, false, common.ErrInvalidDateRange
	}
	req.DateFrom = from
	req.DateTo = to
	// Older chunks from the UI send lookupWindow=1 with an explicit short span.
	// Do not treat a user-picked date range as windowed.
	windowed := hasLookupKey && req.LookupWindow &&
		int(toTime.Sub(fromTime).Hours()/24)+1 <= switchTxnLookupWindowDays+1
	return req, page, pageSize, windowed, nil
}

func switchTxnLookupFloor(asOf time.Time) time.Time {
	return asOf.AddDate(0, -switchTxnLookupMaxMonths, 0)
}

func switchTxnCanExtendOlder(dateFromMMDDYYYY string) bool {
	from, err := time.Parse("01-02-2006", strings.TrimSpace(dateFromMMDDYYYY))
	if err != nil {
		return false
	}
	floor := switchTxnLookupFloor(time.Now().UTC().Truncate(24 * time.Hour))
	return from.After(floor)
}
