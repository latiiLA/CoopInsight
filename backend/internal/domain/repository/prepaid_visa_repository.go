package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

// PrepaidVisaRepository reads Cortex prepaid international Visa (401/402) data.
type PrepaidVisaRepository interface {
	GetDashboard(ctx context.Context, dateFrom, dateTo, product string) (*model.PrepaidVisaDashboard, error)
	ListTopUps(ctx context.Context, filter model.PrepaidVisaListFilter, includeCardholder bool, page, pageSize int) ([]model.PrepaidVisaTopUp, bool, error)
	ListUnloads(ctx context.Context, filter model.PrepaidVisaListFilter, includeCardholder bool, page, pageSize int) ([]model.PrepaidVisaUnload, bool, error)
	ListTransactions(ctx context.Context, filter model.PrepaidVisaListFilter, includeCardholder bool, page, pageSize int) ([]model.PrepaidVisaTransaction, bool, error)
	Search(ctx context.Context, req model.PrepaidVisaSearchRequest, includeCardholder bool, page, pageSize int) (*model.PrepaidVisaSearchResult, error)
	ListCardReconciliation(ctx context.Context, product string, includeCardholder bool) (*model.PrepaidVisaReconcileReport, error)
	GetCardActivity(
		ctx context.Context,
		cardID int64,
		includeCardholder bool,
		topUpPage, unloadPage, ledgerPage, txnPage, pageSize int,
		sections string,
	) (*model.PrepaidVisaCardActivity, error)
}
