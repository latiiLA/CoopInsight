package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type SuccessTransactionRepository interface {
	GetReport(ctx context.Context, dateFrom, dateTo string) (*model.SuccessTransactionReport, error)
}
