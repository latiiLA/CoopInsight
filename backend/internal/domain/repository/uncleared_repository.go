package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type UnclearedRepository interface {
	List(ctx context.Context, msgType int64, dateFrom, dateTo string, sourceBin, destBin int64, page, pageSize int) ([]model.UnclearedTransaction, bool, error)
	// ListExcludingSettled returns uncleared transactions excluding those whose
	// TR_ARF matches any of the provided settled transaction IDs.
	ListExcludingSettled(ctx context.Context, msgType int64, dateFrom, dateTo string, sourceBin, destBin int64, page, pageSize int, settledIDs []string) ([]model.UnclearedTransaction, bool, error)
}
