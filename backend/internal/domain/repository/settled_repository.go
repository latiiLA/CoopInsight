package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type SettledRepository interface {
	List(ctx context.Context, dateFrom, dateTo string, sourceBin, destBin int64, page, pageSize int) ([]model.SettledTransaction, bool, error)
}
