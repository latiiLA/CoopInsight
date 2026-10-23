package service

import (
	"context"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

type PrepaidVisaService interface {
	GetDashboard(ctx context.Context, dateFrom, dateTo, product string) (*model.PrepaidVisaDashboard, error)
	ListTopUps(ctx context.Context, filter model.PrepaidVisaListFilter, includeCardholder bool, page, pageSize int) (ClearingPageResult[model.PrepaidVisaTopUp], error)
	ListUnloads(ctx context.Context, filter model.PrepaidVisaListFilter, includeCardholder bool, page, pageSize int) (ClearingPageResult[model.PrepaidVisaUnload], error)
	ListTransactions(ctx context.Context, filter model.PrepaidVisaListFilter, includeCardholder bool, page, pageSize int) (ClearingPageResult[model.PrepaidVisaTransaction], error)
	Search(ctx context.Context, req model.PrepaidVisaSearchRequest, includeCardholder bool, page, pageSize int) (*model.PrepaidVisaSearchResult, error)
	ListCardReconciliation(ctx context.Context, product string, includeCardholder bool) (*model.PrepaidVisaReconcileReport, error)
	GetCardActivity(
		ctx context.Context,
		cardID int64,
		includeCardholder bool,
		topUpPage, unloadPage, ledgerPage, txnPage, pageSize int,
		sections string,
	) (*model.PrepaidVisaCardActivity, error)
}

type prepaidVisaService struct {
	repository repository.PrepaidVisaRepository
}

func NewPrepaidVisaService(repository repository.PrepaidVisaRepository) PrepaidVisaService {
	return &prepaidVisaService{repository: repository}
}

func (s *prepaidVisaService) GetDashboard(
	ctx context.Context,
	dateFrom, dateTo, product string,
) (*model.PrepaidVisaDashboard, error) {
	from, to, product, err := parsePrepaidVisaArgs(dateFrom, dateTo, product)
	if err != nil {
		return nil, err
	}
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}
	return s.repository.GetDashboard(ctx, from, to, product)
}

func (s *prepaidVisaService) ListTopUps(
	ctx context.Context,
	filter model.PrepaidVisaListFilter,
	includeCardholder bool,
	page, pageSize int,
) (ClearingPageResult[model.PrepaidVisaTopUp], error) {
	from, to, product, page, pageSize, err := parsePrepaidVisaListArgs(
		filter.DateFrom, filter.DateTo, filter.Product, page, pageSize,
	)
	empty := ClearingPageResult[model.PrepaidVisaTopUp]{
		Items:    []model.PrepaidVisaTopUp{},
		Page:     page,
		PageSize: pageSize,
	}
	if err != nil {
		return empty, err
	}
	if s.repository == nil {
		return empty, common.ErrOracleUnavailable
	}
	filter.DateFrom = from
	filter.DateTo = to
	filter.Product = product
	rows, hasMore, err := s.repository.ListTopUps(ctx, filter, includeCardholder, page, pageSize)
	if err != nil {
		return empty, err
	}
	if rows == nil {
		rows = []model.PrepaidVisaTopUp{}
	}
	return ClearingPageResult[model.PrepaidVisaTopUp]{
		Items:    rows,
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
	}, nil
}

func (s *prepaidVisaService) ListUnloads(
	ctx context.Context,
	filter model.PrepaidVisaListFilter,
	includeCardholder bool,
	page, pageSize int,
) (ClearingPageResult[model.PrepaidVisaUnload], error) {
	from, to, product, page, pageSize, err := parsePrepaidVisaListArgs(
		filter.DateFrom, filter.DateTo, filter.Product, page, pageSize,
	)
	empty := ClearingPageResult[model.PrepaidVisaUnload]{
		Items:    []model.PrepaidVisaUnload{},
		Page:     page,
		PageSize: pageSize,
	}
	if err != nil {
		return empty, err
	}
	if s.repository == nil {
		return empty, common.ErrOracleUnavailable
	}
	filter.DateFrom = from
	filter.DateTo = to
	filter.Product = product
	rows, hasMore, err := s.repository.ListUnloads(ctx, filter, includeCardholder, page, pageSize)
	if err != nil {
		return empty, err
	}
	if rows == nil {
		rows = []model.PrepaidVisaUnload{}
	}
	return ClearingPageResult[model.PrepaidVisaUnload]{
		Items:    rows,
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
	}, nil
}

func (s *prepaidVisaService) ListTransactions(
	ctx context.Context,
	filter model.PrepaidVisaListFilter,
	includeCardholder bool,
	page, pageSize int,
) (ClearingPageResult[model.PrepaidVisaTransaction], error) {
	from, to, product, page, pageSize, err := parsePrepaidVisaListArgs(
		filter.DateFrom, filter.DateTo, filter.Product, page, pageSize,
	)
	empty := ClearingPageResult[model.PrepaidVisaTransaction]{
		Items:    []model.PrepaidVisaTransaction{},
		Page:     page,
		PageSize: pageSize,
	}
	if err != nil {
		return empty, err
	}
	if s.repository == nil {
		return empty, common.ErrOracleUnavailable
	}
	filter.DateFrom = from
	filter.DateTo = to
	filter.Product = product
	rows, hasMore, err := s.repository.ListTransactions(ctx, filter, includeCardholder, page, pageSize)
	if err != nil {
		return empty, err
	}
	if rows == nil {
		rows = []model.PrepaidVisaTransaction{}
	}
	return ClearingPageResult[model.PrepaidVisaTransaction]{
		Items:    rows,
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
	}, nil
}

func (s *prepaidVisaService) Search(
	ctx context.Context,
	req model.PrepaidVisaSearchRequest,
	includeCardholder bool,
	page, pageSize int,
) (*model.PrepaidVisaSearchResult, error) {
	req, page, pageSize, err := parsePrepaidVisaSearchArgs(req, includeCardholder, page, pageSize)
	if err != nil {
		return nil, err
	}
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}
	return s.repository.Search(ctx, req, includeCardholder, page, pageSize)
}

func (s *prepaidVisaService) ListCardReconciliation(
	ctx context.Context,
	product string,
	includeCardholder bool,
) (*model.PrepaidVisaReconcileReport, error) {
	product = strings.TrimSpace(product)
	switch product {
	case "", "401", "402":
	default:
		return nil, common.ErrInvalidPrepaidVisaProduct
	}
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}
	return s.repository.ListCardReconciliation(ctx, product, includeCardholder)
}

func (s *prepaidVisaService) GetCardActivity(
	ctx context.Context,
	cardID int64,
	includeCardholder bool,
	topUpPage, unloadPage, ledgerPage, txnPage, pageSize int,
	sections string,
) (*model.PrepaidVisaCardActivity, error) {
	if cardID < 1 {
		return nil, common.ErrInvalidPrepaidVisaCardID
	}
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}
	return s.repository.GetCardActivity(
		ctx, cardID, includeCardholder,
		topUpPage, unloadPage, ledgerPage, txnPage, pageSize, sections,
	)
}

func parsePrepaidVisaArgs(dateFrom, dateTo, product string) (string, string, string, error) {
	from, err := parseReportDate(dateFrom)
	if err != nil {
		return "", "", "", err
	}
	to, err := parseReportDate(dateTo)
	if err != nil {
		return "", "", "", err
	}

	fromTime, _ := time.Parse("01-02-2006", from)
	toTime, _ := time.Parse("01-02-2006", to)
	if fromTime.After(toTime) {
		return "", "", "", common.ErrInvalidDateRange
	}

	product = strings.TrimSpace(product)
	switch product {
	case "", "401", "402":
	default:
		return "", "", "", common.ErrInvalidPrepaidVisaProduct
	}

	return from, to, product, nil
}

func parsePrepaidVisaListArgs(
	dateFrom, dateTo, product string,
	page, pageSize int,
) (string, string, string, int, int, error) {
	from, to, product, err := parsePrepaidVisaArgs(dateFrom, dateTo, product)
	if err != nil {
		return "", "", "", page, pageSize, err
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
	return from, to, product, page, pageSize, nil
}

func parsePrepaidVisaSearchArgs(
	req model.PrepaidVisaSearchRequest,
	includeCardholder bool,
	page, pageSize int,
) (model.PrepaidVisaSearchRequest, int, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 500
	}
	if pageSize > 2000 {
		pageSize = 2000
	}

	kind := strings.ToLower(strings.TrimSpace(req.Kind))
	switch kind {
	case model.PrepaidVisaSearchKindTransactions, model.PrepaidVisaSearchKindTopUps, model.PrepaidVisaSearchKindUnloads:
	case "transaction", "txn":
		kind = model.PrepaidVisaSearchKindTransactions
	case "topup", "top-up", "top_up":
		kind = model.PrepaidVisaSearchKindTopUps
	case "unload":
		kind = model.PrepaidVisaSearchKindUnloads
	default:
		return req, page, pageSize, common.ErrInvalidPrepaidVisaSearchKind
	}
	req.Kind = kind

	product := strings.TrimSpace(req.Product)
	switch product {
	case "", "401", "402":
	default:
		return req, page, pageSize, common.ErrInvalidPrepaidVisaProduct
	}
	req.Product = product

	req.Q = strings.TrimSpace(req.Q)
	req.RRN = strings.TrimSpace(req.RRN)
	req.Card = strings.TrimSpace(req.Card)
	req.Cardholder = strings.TrimSpace(req.Cardholder)
	req.Branch = strings.TrimSpace(req.Branch)
	req.Merchant = strings.TrimSpace(req.Merchant)
	req.Terminal = strings.TrimSpace(req.Terminal)
	req.Account = strings.TrimSpace(req.Account)
	req.Description = strings.TrimSpace(req.Description)
	req.Result = strings.ToLower(strings.TrimSpace(req.Result))
	req.Reversal = strings.ToLower(strings.TrimSpace(req.Reversal))

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

	dateFrom := strings.TrimSpace(req.DateFrom)
	dateTo := strings.TrimSpace(req.DateTo)
	if dateFrom == "" && dateTo == "" {
		// Dates optional only when RRN or Card is set (soft 24-month cap in repo).
		if req.RRN == "" && req.Card == "" {
			return req, page, pageSize, common.ErrPrepaidVisaSearchNeedsCriteria
		}
		req.DateFrom = ""
		req.DateTo = ""
		return req, page, pageSize, nil
	}
	if dateFrom == "" || dateTo == "" {
		return req, page, pageSize, common.ErrInvalidReportDate
	}
	from, to, _, err := parsePrepaidVisaArgs(dateFrom, dateTo, product)
	if err != nil {
		return req, page, pageSize, err
	}
	req.DateFrom = from
	req.DateTo = to

	return req, page, pageSize, nil
}
