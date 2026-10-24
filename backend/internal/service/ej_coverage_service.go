package service

import (
	"context"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"github.com/latiiLA/CoopInsight/backend/internal/service/ejparser"
)

const ejCoverageMaxDays = 31

type EJCoverageService interface {
	GetCoverage(ctx context.Context, req model.EJCoverageRequest) (*model.EJCoverageResult, error)
}

type ejCoverageService struct {
	files        repository.EJFileRepository
	atmTerminals repository.AtmTerminalRepository
}

func NewEJCoverageService(
	files repository.EJFileRepository,
	atmTerminals repository.AtmTerminalRepository,
) EJCoverageService {
	return &ejCoverageService{files: files, atmTerminals: atmTerminals}
}

func (s *ejCoverageService) GetCoverage(
	ctx context.Context,
	req model.EJCoverageRequest,
) (*model.EJCoverageResult, error) {
	if s == nil || s.files == nil {
		return nil, common.ErrEJSearchUnavailable
	}
	if s.atmTerminals == nil {
		return nil, common.ErrSourceMongoUnavailable
	}

	dateFrom, dateTo, rangeDays, err := parseEJCoverageRange(req.DateFrom, req.DateTo)
	if err != nil {
		return nil, err
	}

	weekTo := dateTo
	weekFrom := weekTo.AddDate(0, 0, -6)
	fetchFrom := dateFrom
	if weekFrom.Before(fetchFrom) {
		fetchFrom = weekFrom
	}

	files, err := s.files.ListIndexedForDates(
		ctx,
		fetchFrom.Format("2006-01-02"),
		weekTo.Format("2006-01-02"),
	)
	if err != nil {
		return nil, err
	}

	// key: terminalID|YYYY-MM-DD
	indexed := make(map[string]model.EJFile, len(files))
	for _, f := range files {
		ejDate, term, ok := ejparser.ParseFilename(f.Filename)
		if !ok {
			continue
		}
		term = strings.ToUpper(strings.TrimSpace(term))
		if term == "" {
			term = strings.ToUpper(strings.TrimSpace(f.TerminalID))
		}
		if term == "" || ejDate == "" {
			continue
		}
		indexed[term+"|"+ejDate] = f
	}

	allTerminals, err := s.atmTerminals.FindAll(ctx)
	if err != nil {
		return nil, err
	}
	active := make([]model.AtmTerminal, 0, len(allTerminals))
	for _, t := range allTerminals {
		if t.IsDeleted {
			continue
		}
		id := strings.ToUpper(strings.TrimSpace(t.TerminalID))
		if id == "" {
			continue
		}
		t.TerminalID = id
		active = append(active, t)
	}
	sort.Slice(active, func(i, j int) bool {
		return active[i].TerminalID < active[j].TerminalID
	})
	totalActive := len(active)

	daySummaries := make([]model.EJCoverageDaySummary, 0, len(rangeDays))
	for _, day := range rangeDays {
		synced := 0
		for _, t := range active {
			if _, ok := indexed[t.TerminalID+"|"+day]; ok {
				synced++
			}
		}
		daySummaries = append(daySummaries, model.EJCoverageDaySummary{
			Date:        day,
			Synced:      synced,
			Missing:     totalActive - synced,
			TotalActive: totalActive,
		})
	}

	focusDate := dateTo.Format("2006-01-02")
	focus := model.EJCoverageDaySummary{
		Date:        focusDate,
		TotalActive: totalActive,
	}
	for _, d := range daySummaries {
		if d.Date == focusDate {
			focus = d
			break
		}
	}

	weekDays := enumerateDays(weekFrom, weekTo)
	weekSyncedDays := 0
	weekSumSynced := 0
	for _, day := range weekDays {
		daySynced := 0
		for _, t := range active {
			if _, ok := indexed[t.TerminalID+"|"+day]; ok {
				daySynced++
			}
		}
		weekSumSynced += daySynced
		weekSyncedDays += daySynced
	}
	weekDayCount := len(weekDays)
	avgSynced := 0.0
	if weekDayCount > 0 {
		avgSynced = float64(weekSumSynced) / float64(weekDayCount)
		avgSynced = math.Round(avgSynced*10) / 10
	}
	weekMissingDays := totalActive*weekDayCount - weekSyncedDays

	terminals := make([]model.EJCoverageTerminal, 0, len(active))
	for _, t := range active {
		cells := make(map[string]model.EJCoverageDayCell, len(rangeDays))
		for _, day := range rangeDays {
			cell := model.EJCoverageDayCell{Synced: false}
			if f, ok := indexed[t.TerminalID+"|"+day]; ok {
				cell.Synced = true
				cell.TxnCount = f.TxnCount
				if !f.IndexedAt.IsZero() {
					ts := f.IndexedAt.UTC()
					cell.IndexedAt = &ts
				}
			}
			cells[day] = cell
		}
		terminals = append(terminals, model.EJCoverageTerminal{
			TerminalID:   t.TerminalID,
			TerminalName: strings.TrimSpace(t.TerminalName),
			Status:       strings.TrimSpace(t.Status),
			Days:         cells,
		})
	}

	// Missing for focus day first, then by terminal id.
	sort.SliceStable(terminals, func(i, j int) bool {
		ai := terminals[i].Days[focusDate]
		aj := terminals[j].Days[focusDate]
		if ai.Synced != aj.Synced {
			return !ai.Synced && aj.Synced
		}
		return terminals[i].TerminalID < terminals[j].TerminalID
	})

	return &model.EJCoverageResult{
		DateFrom:    dateFrom.Format("2006-01-02"),
		DateTo:      dateTo.Format("2006-01-02"),
		TotalActive: totalActive,
		Focus:       focus,
		Week: model.EJCoverageWeekSummary{
			DateFrom:            weekFrom.Format("2006-01-02"),
			DateTo:              weekTo.Format("2006-01-02"),
			AvgSynced:           avgSynced,
			SyncedTerminalDays:  weekSyncedDays,
			MissingTerminalDays: weekMissingDays,
			TotalActive:         totalActive,
			DayCount:            weekDayCount,
		},
		Days:      daySummaries,
		Terminals: terminals,
	}, nil
}

func parseEJCoverageRange(rawFrom, rawTo string) (from, to time.Time, days []string, err error) {
	fromStr := normalizeCoverageDate(rawFrom)
	toStr := normalizeCoverageDate(rawTo)
	if fromStr == "" || toStr == "" {
		return time.Time{}, time.Time{}, nil, common.ErrInvalidReportDate
	}
	from, err = time.ParseInLocation("2006-01-02", fromStr, time.Local)
	if err != nil {
		return time.Time{}, time.Time{}, nil, common.ErrInvalidReportDate
	}
	to, err = time.ParseInLocation("2006-01-02", toStr, time.Local)
	if err != nil {
		return time.Time{}, time.Time{}, nil, common.ErrInvalidReportDate
	}
	from = time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, time.Local)
	to = time.Date(to.Year(), to.Month(), to.Day(), 0, 0, 0, 0, time.Local)
	if to.Before(from) {
		return time.Time{}, time.Time{}, nil, common.ErrInvalidDateRange
	}
	span := int(to.Sub(from).Hours()/24) + 1
	if span > ejCoverageMaxDays {
		return time.Time{}, time.Time{}, nil, common.ErrDateRangeTooLarge
	}
	return from, to, enumerateDays(from, to), nil
}

func enumerateDays(from, to time.Time) []string {
	out := make([]string, 0, int(to.Sub(from).Hours()/24)+1)
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		out = append(out, d.Format("2006-01-02"))
	}
	return out
}

func normalizeCoverageDate(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	s = strings.ReplaceAll(s, "/", "-")
	parts := strings.Split(s, "-")
	if len(parts) != 3 {
		return ""
	}
	if len(parts[0]) == 4 {
		return parts[0] + "-" + parts[1] + "-" + parts[2]
	}
	if len(parts[2]) == 4 {
		return parts[2] + "-" + parts[0] + "-" + parts[1]
	}
	return ""
}
