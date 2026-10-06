package service

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

type SuccessTransactionService interface {
	GetReport(ctx context.Context, dateFrom, dateTo, channel, flow string) (*model.SuccessTransactionReport, error)
	GetTrend(ctx context.Context, dateFrom, dateTo, channel, flow, granularity string) (*model.SuccessRateTrendReport, error)
	ListTransactions(
		ctx context.Context,
		dateFrom, dateTo, channel, flow, outcome, respCode string,
		limit int,
	) ([]model.SuccessTransactionDetail, error)
	GetTerminalReport(ctx context.Context, dateFrom, dateTo, channel string) ([]model.TerminalSuccessReport, error)
}

type successTransactionService struct {
	repository   repository.SuccessTransactionRepository
	posTerminals repository.PosTerminalRepository
	atmTerminals repository.AtmTerminalRepository
}

func NewSuccessTransactionService(
	repository repository.SuccessTransactionRepository,
	posTerminals repository.PosTerminalRepository,
	atmTerminals repository.AtmTerminalRepository,
) SuccessTransactionService {
	return &successTransactionService{
		repository:   repository,
		posTerminals: posTerminals,
		atmTerminals: atmTerminals,
	}
}

func (s *successTransactionService) GetReport(ctx context.Context, dateFrom, dateTo, channel, flow string) (*model.SuccessTransactionReport, error) {
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}

	normalizedChannel, err := normalizeSuccessChannel(channel)
	if err != nil {
		return nil, err
	}

	normalizedFlow, err := normalizeSuccessFlow(flow)
	if err != nil {
		return nil, err
	}

	from, err := parseReportDate(dateFrom)
	if err != nil {
		return nil, err
	}

	to, err := parseReportDate(dateTo)
	if err != nil {
		return nil, err
	}

	fromTime, _ := time.Parse("01-02-2006", from)
	toTime, _ := time.Parse("01-02-2006", to)

	if fromTime.After(toTime) {
		return nil, common.ErrInvalidDateRange
	}

	return s.repository.GetReport(ctx, from, to, normalizedChannel, normalizedFlow)
}

const maxTrendBuckets = 400

func (s *successTransactionService) GetTrend(
	ctx context.Context,
	dateFrom, dateTo, channel, flow, granularity string,
) (*model.SuccessRateTrendReport, error) {
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}

	normalizedChannel, err := normalizeSuccessChannel(channel)
	if err != nil {
		return nil, err
	}

	normalizedFlow, err := normalizeSuccessFlow(flow)
	if err != nil {
		return nil, err
	}

	// Switch has no acquiring page in the product; reject to match sidebar.
	if normalizedChannel == "switch" && normalizedFlow == "acquiring" {
		return nil, common.ErrInvalidSuccessFlow
	}

	from, err := parseReportDate(dateFrom)
	if err != nil {
		return nil, err
	}

	to, err := parseReportDate(dateTo)
	if err != nil {
		return nil, err
	}

	fromTime, _ := time.Parse("01-02-2006", from)
	toTime, _ := time.Parse("01-02-2006", to)
	if fromTime.After(toTime) {
		return nil, common.ErrInvalidDateRange
	}

	normalizedGranularity, err := normalizeSuccessGranularity(granularity, fromTime, toTime)
	if err != nil {
		return nil, err
	}

	if estimateTrendBuckets(fromTime, toTime, normalizedGranularity) > maxTrendBuckets {
		return nil, common.ErrTrendRangeTooLarge
	}

	return s.repository.GetTrend(ctx, from, to, normalizedChannel, normalizedFlow, normalizedGranularity)
}

func normalizeSuccessGranularity(granularity string, from, to time.Time) (string, error) {
	switch strings.ToLower(strings.TrimSpace(granularity)) {
	case "day", "week", "month":
		return strings.ToLower(strings.TrimSpace(granularity)), nil
	case "":
		return autoTrendGranularity(from, to), nil
	default:
		return "", common.ErrInvalidSuccessGranularity
	}
}

func autoTrendGranularity(from, to time.Time) string {
	days := int(to.Sub(from).Hours()/24) + 1
	if days <= 30 {
		return "day"
	}
	if days <= 90 {
		return "week"
	}
	return "month"
}

func estimateTrendBuckets(from, to time.Time, granularity string) int {
	days := int(to.Sub(from).Hours()/24) + 1
	if days < 1 {
		days = 1
	}
	switch granularity {
	case "week":
		return (days + 6) / 7
	case "month":
		return (to.Year()-from.Year())*12 + int(to.Month()-from.Month()) + 1
	default:
		return days
	}
}

func (s *successTransactionService) ListTransactions(
	ctx context.Context,
	dateFrom, dateTo, channel, flow, outcome, respCode string,
	limit int,
) ([]model.SuccessTransactionDetail, error) {
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}

	normalizedChannel, err := normalizeSuccessChannel(channel)
	if err != nil {
		return nil, err
	}

	normalizedFlow, err := normalizeSuccessFlow(flow)
	if err != nil {
		return nil, err
	}

	normalizedOutcome, err := normalizeSuccessOutcome(outcome)
	if err != nil {
		return nil, err
	}

	from, err := parseReportDate(dateFrom)
	if err != nil {
		return nil, err
	}

	to, err := parseReportDate(dateTo)
	if err != nil {
		return nil, err
	}

	fromTime, _ := time.Parse("01-02-2006", from)
	toTime, _ := time.Parse("01-02-2006", to)
	if fromTime.After(toTime) {
		return nil, common.ErrInvalidDateRange
	}

	return s.repository.ListTransactions(
		ctx,
		from,
		to,
		normalizedChannel,
		normalizedFlow,
		normalizedOutcome,
		strings.TrimSpace(respCode),
		limit,
	)
}

func (s *successTransactionService) GetTerminalReport(ctx context.Context, dateFrom, dateTo, channel string) ([]model.TerminalSuccessReport, error) {
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}

	normalizedChannel, err := normalizeSuccessChannel(channel)
	if err != nil {
		return nil, err
	}

	// Switch has no per-terminal fleet to reconcile against, and the product
	// exposes terminal success rate per fleet only, so reject it here.
	if normalizedChannel == "switch" {
		return nil, common.ErrInvalidSuccessChannel
	}

	from, err := parseReportDate(dateFrom)
	if err != nil {
		return nil, err
	}

	to, err := parseReportDate(dateTo)
	if err != nil {
		return nil, err
	}

	fromTime, _ := time.Parse("01-02-2006", from)
	toTime, _ := time.Parse("01-02-2006", to)
	if fromTime.After(toTime) {
		return nil, common.ErrInvalidDateRange
	}

	// Oracle rows cover only the terminals that transacted in the range.
	oracleRows, err := s.repository.GetTerminalReport(ctx, from, to, normalizedChannel)
	if err != nil {
		return nil, err
	}

	registered, err := s.registeredTerminalIDs(ctx, normalizedChannel)
	if err != nil || len(registered) == 0 {
		// Fleet list unavailable: report what Oracle has rather than failing.
		return oracleRows, nil
	}

	oracleByID := make(map[string]model.TerminalSuccessReport, len(oracleRows))
	for _, row := range oracleRows {
		oracleByID[normalizeTerminalID(row.TerminalID)] = row
	}

	// Registered terminals with no transactions become zero-filled rows, so a
	// dormant terminal reads as inactive instead of disappearing from the fleet.
	merged := make([]model.TerminalSuccessReport, 0, len(registered))
	for id := range registered {
		if row, ok := oracleByID[id]; ok {
			merged = append(merged, row)
			continue
		}
		merged = append(merged, model.TerminalSuccessReport{
			TerminalID:     registered[id],
			Channel:        normalizedChannel,
			DeclineReasons: []model.DeclineReason{},
		})
	}

	// A terminal can transact on a card that is not in the fleet table, so keep
	// any Oracle row that no registered terminal claimed.
	for _, row := range oracleRows {
		if _, ok := registered[normalizeTerminalID(row.TerminalID)]; !ok {
			merged = append(merged, row)
		}
	}

	sort.SliceStable(merged, func(i, j int) bool {
		if merged[i].TotalTransactions != merged[j].TotalTransactions {
			return merged[i].TotalTransactions > merged[j].TotalTransactions
		}
		return merged[i].TerminalID < merged[j].TerminalID
	})

	return merged, nil
}

// registeredTerminalIDs returns the live fleet from source MongoDB, keyed by
// normalized terminal id with the original id kept as the value.
func (s *successTransactionService) registeredTerminalIDs(ctx context.Context, channel string) (map[string]string, error) {
	out := make(map[string]string)

	switch channel {
	case "pos":
		if s.posTerminals == nil {
			return nil, common.ErrSourceMongoUnavailable
		}
		terminals, err := s.posTerminals.FindAll(ctx)
		if err != nil {
			return nil, err
		}
		for _, terminal := range terminals {
			if terminal.IsDeleted {
				continue
			}
			id := strings.TrimSpace(terminal.TerminalID)
			if key := normalizeTerminalID(id); key != "" {
				out[key] = id
			}
		}
	default: // atm
		if s.atmTerminals == nil {
			return nil, common.ErrSourceMongoUnavailable
		}
		terminals, err := s.atmTerminals.FindAll(ctx)
		if err != nil {
			return nil, err
		}
		for _, terminal := range terminals {
			if terminal.IsDeleted {
				continue
			}
			id := strings.TrimSpace(terminal.TerminalID)
			if key := normalizeTerminalID(id); key != "" {
				out[key] = id
			}
		}
	}

	return out, nil
}

func normalizeSuccessOutcome(outcome string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(outcome)) {
	case "", "all":
		return "all", nil
	case "approved", "success":
		return "approved", nil
	case "declined", "failed":
		return "declined", nil
	default:
		return "", common.ErrInvalidSuccessOutcome
	}
}

func normalizeSuccessChannel(channel string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(channel)) {
	case "", "atm":
		return "atm", nil
	case "pos":
		return "pos", nil
	case "switch", "all", "overall":
		return "switch", nil
	default:
		return "", common.ErrInvalidSuccessChannel
	}
}

func normalizeSuccessFlow(flow string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(flow)) {
	case "", "acquiring":
		return "acquiring", nil
	case "onus", "on-us":
		return "onus", nil
	case "offus", "off-us":
		return "offus", nil
	case "issuing":
		return "issuing", nil
	case "overall":
		return "overall", nil
	default:
		return "", common.ErrInvalidSuccessFlow
	}
}

func parseReportDate(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", common.ErrInvalidReportDate
	}

	layouts := []string{"01-02-2006", "01/02/2006"}
	for _, layout := range layouts {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			return parsed.Format("01-02-2006"), nil
		}
	}

	return "", common.ErrInvalidReportDate
}
