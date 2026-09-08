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

const comparisonLimit = 10

type TerminalTransactionService interface {
	GetByTerminal(
		ctx context.Context,
		terminalID, dateFrom, dateTo string,
	) ([]model.TerminalTransaction, error)
	GetComparison(
		ctx context.Context,
		fleet, dateFrom, dateTo string,
	) (*model.TerminalPerformanceReport, error)
}

type terminalTransactionService struct {
	repository   repository.TerminalTransactionRepository
	atmTerminals repository.AtmTerminalRepository
	posTerminals repository.PosTerminalRepository
}

func NewTerminalTransactionService(
	transactions repository.TerminalTransactionRepository,
	atmTerminals repository.AtmTerminalRepository,
	posTerminals repository.PosTerminalRepository,
) TerminalTransactionService {
	return &terminalTransactionService{
		repository:   transactions,
		atmTerminals: atmTerminals,
		posTerminals: posTerminals,
	}
}

func (s *terminalTransactionService) GetByTerminal(
	ctx context.Context,
	terminalID, dateFrom, dateTo string,
) ([]model.TerminalTransaction, error) {
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}

	terminalID = strings.TrimSpace(terminalID)
	if terminalID == "" {
		return nil, common.ErrInvalidTerminalID
	}

	from, to, err := parseComparisonDates(dateFrom, dateTo)
	if err != nil {
		return nil, err
	}

	rows, err := s.repository.GetByTerminal(ctx, terminalID, from, to)
	if err != nil {
		return nil, err
	}

	if rows == nil {
		return []model.TerminalTransaction{}, nil
	}

	for i := range rows {
		rows[i].TxnType = txnTypeName(rows[i].TxnCode)
	}

	return rows, nil
}

func (s *terminalTransactionService) GetComparison(
	ctx context.Context,
	fleet, dateFrom, dateTo string,
) (*model.TerminalPerformanceReport, error) {
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}

	from, to, err := parseComparisonDates(dateFrom, dateTo)
	if err != nil {
		return nil, err
	}

	fleetTerminals, err := s.liveFleet(ctx, fleet)
	if err != nil {
		return nil, err
	}

	stats, err := s.repository.GetPerformance(ctx, from, to)
	if err != nil {
		return nil, err
	}

	byID := make(map[string]model.TerminalPerformanceRow, len(stats))
	for _, row := range stats {
		key := normalizeTerminalID(row.TerminalID)
		if key == "" {
			continue
		}
		byID[key] = row
	}

	rows := make([]model.TerminalPerformanceRow, 0, len(fleetTerminals))
	var transactionCount int
	var totalAmount float64
	activeCount := 0

	for _, terminal := range fleetTerminals {
		row := model.TerminalPerformanceRow{
			TerminalID:   terminal.id,
			TerminalName: terminal.name,
			BranchName:   terminal.branch,
		}
		if stat, ok := byID[terminal.key]; ok {
			row.TransactionCount = stat.TransactionCount
			row.ApprovedCount = stat.ApprovedCount
			row.Amount = stat.Amount
			row.ApprovedAmount = stat.ApprovedAmount
			if row.TerminalName == "" {
				row.TerminalName = stat.TerminalName
			}
		}
		if row.TransactionCount > 0 {
			activeCount++
		}
		transactionCount += row.TransactionCount
		totalAmount += row.Amount
		rows = append(rows, row)
	}

	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].TransactionCount != rows[j].TransactionCount {
			return rows[i].TransactionCount > rows[j].TransactionCount
		}
		if rows[i].Amount != rows[j].Amount {
			return rows[i].Amount > rows[j].Amount
		}
		return rows[i].TerminalID < rows[j].TerminalID
	})

	for i := range rows {
		rows[i].Rank = i + 1
	}

	return &model.TerminalPerformanceReport{
		Fleet:            fleet,
		TerminalCount:    len(rows),
		ActiveCount:      activeCount,
		TransactionCount: transactionCount,
		TotalAmount:      totalAmount,
		Highest:          takeHighest(rows, comparisonLimit),
		Lowest:           takeLowest(rows, comparisonLimit),
		Rows:             rows,
	}, nil
}

type fleetTerminal struct {
	key    string
	id     string
	name   string
	branch string
}

func (s *terminalTransactionService) liveFleet(
	ctx context.Context,
	fleet string,
) ([]fleetTerminal, error) {
	switch fleet {
	case "atm":
		if s.atmTerminals == nil {
			return nil, common.ErrSourceMongoUnavailable
		}
		terminals, err := s.atmTerminals.FindAll(ctx)
		if err != nil {
			return nil, err
		}
		results := make([]fleetTerminal, 0, len(terminals))
		for _, terminal := range terminals {
			if terminal.IsDeleted {
				continue
			}
			id := strings.TrimSpace(terminal.TerminalID)
			key := normalizeTerminalID(id)
			if key == "" {
				continue
			}
			results = append(results, fleetTerminal{
				key:    key,
				id:     id,
				name:   strings.TrimSpace(terminal.TerminalName),
				branch: strings.TrimSpace(terminal.BranchName),
			})
		}
		return results, nil
	case "pos":
		if s.posTerminals == nil {
			return nil, common.ErrSourceMongoUnavailable
		}
		terminals, err := s.posTerminals.FindAll(ctx)
		if err != nil {
			return nil, err
		}
		results := make([]fleetTerminal, 0, len(terminals))
		for _, terminal := range terminals {
			if terminal.IsDeleted {
				continue
			}
			id := strings.TrimSpace(terminal.TerminalID)
			key := normalizeTerminalID(id)
			if key == "" {
				continue
			}
			results = append(results, fleetTerminal{
				key:    key,
				id:     id,
				name:   strings.TrimSpace(terminal.MerchantName),
				branch: strings.TrimSpace(terminal.BranchName),
			})
		}
		return results, nil
	default:
		return nil, common.ErrInvalidFleet
	}
}

func parseComparisonDates(dateFrom, dateTo string) (string, string, error) {
	from, err := parseReportDate(dateFrom)
	if err != nil {
		return "", "", err
	}

	to, err := parseReportDate(dateTo)
	if err != nil {
		return "", "", err
	}

	fromTime, _ := time.Parse("01-02-2006", from)
	toTime, _ := time.Parse("01-02-2006", to)

	if fromTime.After(toTime) {
		return "", "", common.ErrInvalidDateRange
	}

	return from, to, nil
}

func normalizeTerminalID(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func takeHighest(rows []model.TerminalPerformanceRow, limit int) []model.TerminalPerformanceRow {
	if len(rows) < limit {
		limit = len(rows)
	}
	highest := make([]model.TerminalPerformanceRow, limit)
	copy(highest, rows[:limit])
	return highest
}

func takeLowest(rows []model.TerminalPerformanceRow, limit int) []model.TerminalPerformanceRow {
	if len(rows) < limit {
		limit = len(rows)
	}
	lowest := make([]model.TerminalPerformanceRow, 0, limit)
	for i := 0; i < limit; i++ {
		lowest = append(lowest, rows[len(rows)-1-i])
	}
	return lowest
}

func txnTypeName(code string) string {
	switch strings.TrimSpace(code) {
	case "1", "01":
		return "Withdrawal"
	case "20":
		return "Refund"
	case "21":
		return "Deposit"
	case "30", "31":
		return "Balance inquiry"
	case "40":
		return "Transfer"
	case "50":
		return "Payment"
	default:
		return code
	}
}
