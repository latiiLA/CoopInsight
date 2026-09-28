package service

import (
	"context"
	"sort"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

// CardDetailPage is one page of individual card records. The shape matches
// ClearingPageResult so the frontend paging loop is identical for both.
type CardDetailPage struct {
	Items    []model.CardDetail `json:"items"`
	Page     int                `json:"page"`
	PageSize int                `json:"pageSize"`
	HasMore  bool               `json:"hasMore"`
	// Metric and BranchID echo the applied filters so the client can label the
	// result without echoing its own request back.
	Metric   string `json:"metric"`
	BranchID *int64 `json:"branchId,omitempty"`
	// CardholderVisible reports whether the caller may see the name column, so
	// the UI can explain its absence instead of rendering a blank column.
	CardholderVisible bool `json:"cardholderVisible"`
}

type CardService interface {
	CountCardPerStatus(ctx context.Context, filter repository.CardStatusFilter) ([]model.Card, error)
	CardActivity(ctx context.Context, dateFrom, dateTo string) (*model.CardActivityReport, error)
	CardActivityByBranch(ctx context.Context, dateFrom, dateTo string) ([]model.CardBranchActivity, error)
	CardBranchTrend(ctx context.Context, branchID int64, dateFrom, dateTo string) (*model.CardActivityReport, error)
	// CardDetails lists the individual cards behind an activity count. The
	// includeCardholder flag is decided by the delivery layer from the caller's
	// permissions; the service trusts it and never widens it.
	CardDetails(
		ctx context.Context,
		metric string,
		dateFrom, dateTo string,
		branchID *int64,
		page, pageSize int,
		includeCardholder bool,
	) (CardDetailPage, error)
}

type cardService struct {
	repository repository.CardRepository
}

func NewCardService(repository repository.CardRepository) CardService {
	return &cardService{repository: repository}
}

func (s *cardService) CountCardPerStatus(
	ctx context.Context,
	filter repository.CardStatusFilter,
) ([]model.Card, error) {
	if s.repository == nil {
		return []model.Card{}, common.ErrOracleUnavailable
	}

	// Validate here so a bad option is a 400 rather than a 500 from the
	// repository's whitelist lookup failing.
	switch filter.GroupBy {
	case "status", "product", "branch", "status-product", "status-branch":
	default:
		return nil, common.ErrInvalidCardGroupBy
	}

	switch filter.DateField {
	case "created", "statusChanged":
	default:
		return nil, common.ErrInvalidCardDateField
	}

	if filter.BranchID != nil && *filter.BranchID <= 0 {
		return nil, common.ErrInvalidCardBranchID
	}
	if filter.ProductID != nil && *filter.ProductID <= 0 {
		return nil, common.ErrInvalidCardProductID
	}

	// Bounded so a stray value cannot turn the expiry measure into a scan of
	// arbitrary length, and so a nonsensical window is reported rather than
	// silently returning zero.
	if filter.ExpiringWithinMonths < 0 || filter.ExpiringWithinMonths > 120 {
		return nil, common.ErrInvalidCardExpiryWindow
	}

	// A malformed date arrives as the zero time from the delivery layer, and an
	// inverted range is rejected rather than silently swapped.
	if filter.DateFrom != nil && filter.DateFrom.IsZero() {
		return nil, common.ErrInvalidReportDate
	}
	if filter.DateTo != nil && filter.DateTo.IsZero() {
		return nil, common.ErrInvalidReportDate
	}
	if filter.DateFrom != nil && filter.DateTo != nil &&
		filter.DateTo.Before(*filter.DateFrom) {
		return nil, common.ErrInvalidDateRange
	}

	rows, err := s.repository.CountCardPerStatus(ctx, filter)
	if err != nil {
		return nil, err
	}

	if rows == nil {
		rows = []model.Card{}
	}

	return rows, nil
}

func (s *cardService) CardActivity(
	ctx context.Context,
	dateFrom, dateTo string,
) (*model.CardActivityReport, error) {
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}

	start, end, err := resolveCardRange(dateFrom, dateTo)
	if err != nil {
		return nil, err
	}

	rows, err := s.repository.CardActivity(ctx, start, end)
	if err != nil {
		return nil, err
	}

	return buildActivityReport(rows, start, end), nil
}

func (s *cardService) CardActivityByBranch(
	ctx context.Context,
	dateFrom, dateTo string,
) ([]model.CardBranchActivity, error) {
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}

	start, end, err := resolveCardRange(dateFrom, dateTo)
	if err != nil {
		return nil, err
	}

	branches, err := s.repository.CardActivityByBranch(ctx, start, end)
	if err != nil {
		return nil, err
	}

	if branches == nil {
		branches = []model.CardBranchActivity{}
	}

	// Highest total activity first; ties broken by name for stable output.
	sort.Slice(branches, func(i, j int) bool {
		if branches[i].Total() != branches[j].Total() {
			return branches[i].Total() > branches[j].Total()
		}
		return branches[i].BranchName < branches[j].BranchName
	})

	return branches, nil
}

func (s *cardService) CardBranchTrend(
	ctx context.Context,
	branchID int64,
	dateFrom, dateTo string,
) (*model.CardActivityReport, error) {
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}

	start, end, err := resolveCardRange(dateFrom, dateTo)
	if err != nil {
		return nil, err
	}

	rows, err := s.repository.CardActivityForBranch(ctx, branchID, start, end)
	if err != nil {
		return nil, err
	}

	return buildActivityReport(rows, start, end), nil
}

// CardDetails validates the filters and delegates to the repository. A bad
// metric or date is rejected here so it surfaces as 400 rather than 500.
func (s *cardService) CardDetails(
	ctx context.Context,
	metric string,
	dateFrom, dateTo string,
	branchID *int64,
	page, pageSize int,
	includeCardholder bool,
) (CardDetailPage, error) {
	if s.repository == nil {
		return CardDetailPage{}, common.ErrOracleUnavailable
	}

	switch metric {
	case model.CardMetricCreated, model.CardMetricIssued, model.CardMetricActivated:
	default:
		return CardDetailPage{}, common.ErrInvalidCardMetric
	}

	if branchID != nil && *branchID <= 0 {
		return CardDetailPage{}, common.ErrInvalidCardBranchID
	}

	// Normalised here rather than only in the repository, because the echoed
	// page and pageSize are what the client uses to request the next page.
	page, pageSize = normalizeCardDetailPageArgs(page, pageSize)

	// Detail rows are always an explicit drill-down, so both bounds are
	// required; defaulting to the trailing 30 days would silently return an
	// unbounded list.
	if dateFrom == "" || dateTo == "" {
		return CardDetailPage{}, common.ErrInvalidReportDate
	}

	start, end, err := resolveCardRange(dateFrom, dateTo)
	if err != nil {
		return CardDetailPage{}, err
	}

	items, hasMore, err := s.repository.ListCardDetails(
		ctx,
		metric,
		start,
		end,
		branchID,
		page,
		pageSize,
		includeCardholder,
	)
	if err != nil {
		return CardDetailPage{}, err
	}

	if items == nil {
		items = []model.CardDetail{}
	}

	return CardDetailPage{
		Items:             items,
		Page:              page,
		PageSize:          pageSize,
		HasMore:           hasMore,
		Metric:            metric,
		BranchID:          branchID,
		CardholderVisible: includeCardholder,
	}, nil
}

// resolveCardRange parses the MM/dd/yyyy bounds, defaulting to the trailing
// 30 days (inclusive) and normalizing to UTC midnight so day iteration and
// gap-filling are well defined.
func resolveCardRange(dateFrom, dateTo string) (time.Time, time.Time, error) {
	from, to, err := parseCardStatusDates(dateFrom, dateTo)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}

	if to == nil {
		now := time.Now().UTC()
		today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
		to = &today
	}
	if from == nil {
		start := to.AddDate(0, 0, -29)
		from = &start
	}

	start := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, time.UTC)
	end := time.Date(to.Year(), to.Month(), to.Day(), 0, 0, 0, 0, time.UTC)
	if end.Before(start) {
		start, end = end, start
	}

	return start, end, nil
}

// buildActivityReport gap-fills the sparse per-day rows across [start, end]
// and computes the range totals.
func buildActivityReport(
	rows []model.CardDailyActivity,
	start time.Time,
	end time.Time,
) *model.CardActivityReport {
	byDate := make(map[string]model.CardDailyActivity, len(rows))
	for _, row := range rows {
		byDate[row.Date] = row
	}

	daily := make([]model.CardDailyActivity, 0)
	var totals model.CardActivityTotals

	for day := start; !day.After(end); day = day.AddDate(0, 0, 1) {
		key := day.Format("2006-01-02")
		entry := byDate[key]
		entry.Date = key
		daily = append(daily, entry)

		totals.Created += entry.Created
		totals.Issued += entry.Issued
		totals.Activated += entry.Activated
	}

	return &model.CardActivityReport{
		From:   start.Format("2006-01-02"),
		To:     end.Format("2006-01-02"),
		Totals: totals,
		Daily:  daily,
	}
}

// parseCardStatusDates parses the optional MM/dd/yyyy bounds. A malformed bound
// returns common.ErrInvalidReportDate so the handler answers 400 rather than
// falling through to 500 with the raw time.Parse text in the error field.
func parseCardStatusDates(
	dateFrom, dateTo string,
) (*time.Time, *time.Time, error) {
	var from *time.Time
	var to *time.Time

	if dateFrom != "" {
		parsed, err := time.Parse("01/02/2006", dateFrom)
		if err != nil {
			return nil, nil, common.ErrInvalidReportDate
		}
		from = &parsed
	}

	if dateTo != "" {
		parsed, err := time.Parse("01/02/2006", dateTo)
		if err != nil {
			return nil, nil, common.ErrInvalidReportDate
		}
		to = &parsed
	}

	return from, to, nil
}

// Card detail paging defaults. Kept in step with the repository's own clamps.
const (
	cardDetailDefaultPageSize = 200
	cardDetailMaxPageSize     = 1000
)

func normalizeCardDetailPageArgs(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = cardDetailDefaultPageSize
	}
	if pageSize > cardDetailMaxPageSize {
		pageSize = cardDetailMaxPageSize
	}
	return page, pageSize
}
