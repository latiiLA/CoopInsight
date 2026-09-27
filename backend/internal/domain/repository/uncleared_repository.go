package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type UnclearedRepository interface {
	List(ctx context.Context, msgType int64, dateFrom, dateTo string, sourceBin, destBin int64, page, pageSize int) ([]model.UnclearedTransaction, bool, error)
}
