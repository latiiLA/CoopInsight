package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type UnsettledRepository interface {
	List(ctx context.Context, dateFrom, dateTo string, sourceBin, destBin int64, page, pageSize int) ([]model.UnsettledTransaction, bool, error)
}
