package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

// EJTransactionRepository stores and searches indexed EJ journal rows.
type EJTransactionRepository interface {
	EnsureIndexes(ctx context.Context) error
	ReplaceFileTransactions(
		ctx context.Context,
		terminalID, filename string,
		txns []model.EJTransaction,
	) error
	AppendTransactions(
		ctx context.Context,
		terminalID, filename string,
		txns []model.EJTransaction,
	) error
	Search(
		ctx context.Context,
		req model.EJTransactionSearchRequest,
		page, pageSize int,
	) ([]model.EJTransaction, bool, error)
	GetByID(ctx context.Context, id string) (*model.EJTransaction, error)
}

// EJFileRepository tracks which EJ files have been indexed (mtime/size skip).
type EJFileRepository interface {
	EnsureIndexes(ctx context.Context) error
	Find(ctx context.Context, terminalID, filename string) (*model.EJFile, error)
	Upsert(ctx context.Context, file model.EJFile) error
	// ListIndexedForDates returns indexed EJ file rows whose filename date
	// prefix falls in [dateFrom, dateTo] inclusive (YYYY-MM-DD).
	ListIndexedForDates(ctx context.Context, dateFrom, dateTo string) ([]model.EJFile, error)
}
