package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

// CortexTransactionSearchRepository looks up cortex.tlog rows for Reports search.
type CortexTransactionSearchRepository interface {
	Search(
		ctx context.Context,
		req model.CortexTransactionSearchRequest,
		includeCardholder bool,
		page, pageSize int,
	) (*model.CortexTransactionSearchResult, error)
	GetByID(ctx context.Context, tlogID int64, includeCardholder bool) (*model.CortexTransactionDetail, error)
}
