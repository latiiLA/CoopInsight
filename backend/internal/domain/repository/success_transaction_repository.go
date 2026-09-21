package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type SuccessTransactionRepository interface {
	GetReport(ctx context.Context, dateFrom, dateTo, channel, flow string) (*model.SuccessTransactionReport, error)
	GetTrend(ctx context.Context, dateFrom, dateTo, channel, flow, granularity string) (*model.SuccessRateTrendReport, error)
	ListTransactions(
		ctx context.Context,
		dateFrom, dateTo, channel, flow, outcome, respCode string,
		limit int,
	) ([]model.SuccessTransactionDetail, error)
}
