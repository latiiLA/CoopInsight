package service

import (
	"context"
	"sort"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

type CardService interface {
	CountCardPerStatus(ctx context.Context, dateFrom, dateTo string) ([]model.Card, error)
	CardActivity(ctx context.Context, dateFrom, dateTo string) (*model.CardActivityReport, error)
	CardActivityByBranch(ctx context.Context, dateFrom, dateTo string) ([]model.CardBranchActivity, error)
	CardBranchTrend(ctx context.Context, branchID int64, dateFrom, dateTo string) (*model.CardActivityReport, error)
}

type cardService struct {
	repository repository.CardRepository
}

func NewCardService(repository repository.CardRepository) CardService {
	return &cardService{repository: repository}
}

func (s *cardService) CountCardPerStatus(
	ctx context.Context,
	dateFrom, dateTo string,
) ([]model.Card, error) {
	if s.repository == nil {
		return []model.Card{}, common.ErrOracleUnavailable
	}

	from, to, err := parseCardStatusDates(dateFrom, dateTo)
	if err != nil {
		return nil, err
	}

	rows, err := s.repository.CountCardPerStatus(ctx, from, to)
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

func parseCardStatusDates(
	dateFrom, dateTo string,
) (*time.Time, *time.Time, error) {
	var from *time.Time
	var to *time.Time

	if dateFrom != "" {
		parsed, err := time.Parse("01/02/2006", dateFrom)
		if err != nil {
			return nil, nil, err
		}
		from = &parsed
	}

	if dateTo != "" {
		parsed, err := time.Parse("01/02/2006", dateTo)
		if err != nil {
			return nil, nil, err
		}
		to = &parsed
	}

	return from, to, nil
}
