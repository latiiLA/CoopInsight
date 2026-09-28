package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type UnsettledRepository interface {
	List(ctx context.Context, msgType int64, dateFrom, dateTo string, sourceBin, destBin int64, page, pageSize int) ([]model.UnsettledTransaction, bool, error)
	// ListExcludingSettled returns unsettled transactions excluding those whose
	// TR_ARF matches any of the provided settled transaction IDs.
	ListExcludingSettled(ctx context.Context, msgType int64, dateFrom, dateTo string, sourceBin, destBin int64, page, pageSize int, settledIDs []string) ([]model.UnsettledTransaction, bool, error)
}
