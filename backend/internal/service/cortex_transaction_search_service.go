package service

import (
	"context"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

type CortexTransactionSearchService interface {
	Search(
		ctx context.Context,
		req model.CortexTransactionSearchRequest,
		includeCardholder bool,
		page, pageSize int,
	) (*model.CortexTransactionSearchResult, error)
	GetByID(ctx context.Context, tlogID int64, includeCardholder bool) (*model.CortexTransactionDetail, error)
}

type cortexTransactionSearchService struct {
	repository repository.CortexTransactionSearchRepository
}

func NewCortexTransactionSearchService(
	repository repository.CortexTransactionSearchRepository,
) CortexTransactionSearchService {
	return &cortexTransactionSearchService{repository: repository}
}

func (s *cortexTransactionSearchService) Search(
	ctx context.Context,
	req model.CortexTransactionSearchRequest,
	includeCardholder bool,
	page, pageSize int,
) (*model.CortexTransactionSearchResult, error) {
	req, page, pageSize, err := parseCortexTxnSearchArgs(req, includeCardholder, page, pageSize)
	if err != nil {
		return nil, err
	}
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}
	return s.repository.Search(ctx, req, includeCardholder, page, pageSize)
}

func (s *cortexTransactionSearchService) GetByID(
	ctx context.Context,
	tlogID int64,
	includeCardholder bool,
) (*model.CortexTransactionDetail, error) {
	if tlogID < 1 {
		return nil, common.ErrInvalidCortexTlogID
	}
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}
	return s.repository.GetByID(ctx, tlogID, includeCardholder)
}

func parseCortexTxnSearchArgs(
	req model.CortexTransactionSearchRequest,
	includeCardholder bool,
	page, pageSize int,
) (model.CortexTransactionSearchRequest, int, int, error) {
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
	req.Cardholder = strings.TrimSpace(req.Cardholder)
	req.Branch = strings.TrimSpace(req.Branch)
	req.Merchant = strings.TrimSpace(req.Merchant)
	req.Terminal = strings.TrimSpace(req.Terminal)
	req.TxnCode = strings.TrimSpace(req.TxnCode)
	req.STAN = strings.TrimSpace(req.STAN)
	req.Account = strings.TrimSpace(req.Account)
	req.ApprovalCode = strings.TrimSpace(req.ApprovalCode)
	req.RspCode = strings.TrimSpace(req.RspCode)
	req.Currency = strings.TrimSpace(req.Currency)
	req.MCC = strings.TrimSpace(req.MCC)
	req.AcquiringCountry = strings.TrimSpace(req.AcquiringCountry)
	req.Result = strings.ToLower(strings.TrimSpace(req.Result))
	req.Reversal = strings.ToLower(strings.TrimSpace(req.Reversal))
	if req.TlogID != nil && *req.TlogID < 1 {
		req.TlogID = nil
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

	if !includeCardholder {
		req.Cardholder = ""
	}

	hasLookupKey := req.RRN != "" ||
		req.Card != "" ||
		req.STAN != "" ||
		(req.TlogID != nil && *req.TlogID > 0)

	dateFrom := strings.TrimSpace(req.DateFrom)
	dateTo := strings.TrimSpace(req.DateTo)
	if dateFrom == "" && dateTo == "" {
		if !hasLookupKey {
			return req, page, pageSize, common.ErrCortexTxnSearchNeedsCriteria
		}
		req.DateFrom = ""
		req.DateTo = ""
		return req, page, pageSize, nil
	}
	if dateFrom == "" || dateTo == "" {
		return req, page, pageSize, common.ErrInvalidReportDate
	}

	from, err := parseReportDate(dateFrom)
	if err != nil {
		return req, page, pageSize, err
	}
	to, err := parseReportDate(dateTo)
	if err != nil {
		return req, page, pageSize, err
	}
	fromTime, _ := time.Parse("01-02-2006", from)
	toTime, _ := time.Parse("01-02-2006", to)
	if fromTime.After(toTime) {
		return req, page, pageSize, common.ErrInvalidDateRange
	}
	req.DateFrom = from
	req.DateTo = to
	return req, page, pageSize, nil
}
