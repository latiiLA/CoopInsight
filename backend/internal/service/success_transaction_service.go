package service

import (
	"context"
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
}

type successTransactionService struct {
	repository repository.SuccessTransactionRepository
}

func NewSuccessTransactionService(repository repository.SuccessTransactionRepository) SuccessTransactionService {
	return &successTransactionService{
		repository: repository,
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
