package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type UnsettledRepository interface {
	ListETH(ctx context.Context, dateFrom, dateTo string) ([]model.UnsettledTransaction, error)
}
