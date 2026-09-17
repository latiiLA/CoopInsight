package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type UnclearedRepository interface {
	List(ctx context.Context, dateFrom, dateTo string, sourceBin, destBin int64) ([]model.UnclearedTransaction, error)
}
