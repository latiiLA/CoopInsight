package repository

import (
	"context"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type VisaSettlementRepository interface {
	// Ingest
	//
	// UpsertTransactions stores the records idempotently, keyed on transaction
	// id, and reports how many were new and how many had been seen before.
	UpsertTransactions(ctx context.Context, txs []model.VisaSettlementTransaction) (inserted, duplicates int, err error)
	SaveBatchSummary(ctx context.Context, summary *model.SettlementBatchSummary) error

	// EnsureIndexes creates the collection indexes, including the unique index
	// on transaction id that makes re-uploading a file idempotent. It is called
	// at startup rather than lazily, so the index exists before the first
	// upload is accepted.
	EnsureIndexes(ctx context.Context) error

	// Fetch
	FindByDateRange(ctx context.Context, start, end time.Time) ([]model.VisaSettlementTransaction, error)
	// FindByTransactionIDPrefix returns records whose transaction id starts
	// with the given text, for searching a truncated id.
	FindByTransactionIDPrefix(ctx context.Context, prefix string, limit int) ([]model.VisaSettlementTransaction, error)
	// FindByBatchID returns the records captured by one upload, in file order.
	FindByBatchID(ctx context.Context, batchID primitive.ObjectID) ([]model.VisaSettlementTransaction, error)
	FindByTransactionID(ctx context.Context, transactionID string) (*model.VisaSettlementTransaction, error)
	FindByAccountNumber(ctx context.Context, accountNumber string) ([]model.VisaSettlementTransaction, error)
	FindBatchSummaryByID(ctx context.Context, batchID string) (*model.SettlementBatchSummary, error)
	ListBatchSummaries(ctx context.Context, limit int64) ([]model.SettlementBatchSummary, error)
}
