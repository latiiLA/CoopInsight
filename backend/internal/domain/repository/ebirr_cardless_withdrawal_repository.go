package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type EbirrCardlessWithdrawalRepository interface {
	GetReport(ctx context.Context, dateFrom, dateTo string) ([]model.EbirrCardlessWithdrawal, error)
}
