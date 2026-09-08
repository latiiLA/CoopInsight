package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type TerminalTransactionRepository interface {
	GetByTerminal(
		ctx context.Context,
		terminalID, dateFrom, dateTo string,
	) ([]model.TerminalTransaction, error)
	GetPerformance(
		ctx context.Context,
		dateFrom, dateTo string,
	) ([]model.TerminalPerformanceRow, error)
}
