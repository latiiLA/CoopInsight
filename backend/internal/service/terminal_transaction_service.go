package service

import (
	"context"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

type TerminalTransactionService interface {
	GetByTerminal(
		ctx context.Context,
		terminalID, dateFrom, dateTo string,
	) ([]model.TerminalTransaction, error)
}

type terminalTransactionService struct {
	repository repository.TerminalTransactionRepository
}

func NewTerminalTransactionService(
	repository repository.TerminalTransactionRepository,
) TerminalTransactionService {
	return &terminalTransactionService{
		repository: repository,
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
