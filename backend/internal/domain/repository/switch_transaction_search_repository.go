package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

// SwitchTransactionSearchRepository looks up oasis.shclog rows for Reports search.
type SwitchTransactionSearchRepository interface {
	Search(
		ctx context.Context,
		req model.SwitchTransactionSearchRequest,
		page, pageSize int,
	) (*model.SwitchTransactionSearchResult, error)
	GetByRowID(ctx context.Context, rowID string) (*model.SwitchTransactionDetail, error)
}
