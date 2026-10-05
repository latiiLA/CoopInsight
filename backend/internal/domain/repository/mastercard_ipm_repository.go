package repository

import (
	"context"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type MastercardIPMRepository interface {
	// Ingest
	UpsertTransactions(ctx context.Context, txs []model.MastercardIPMTransaction) (inserted, duplicates int, err error)
	SaveBatchSummary(ctx context.Context, summary *model.MastercardIPMBatchSummary) error
	EnsureIndexes(ctx context.Context) error

	// Fetch
	FindByDateRange(ctx context.Context, start, end time.Time) ([]model.MastercardIPMTransaction, error)
	// FindSettlementSummariesByDateRange returns IPM settlement summary rows
	// (message_type SETTLEMENT_SUMMARY / function 68x) whose transaction_date
	// falls in [start, end] inclusive by calendar day (UTC).
	FindSettlementSummariesByDateRange(ctx context.Context, start, end time.Time) ([]model.MastercardIPMTransaction, error)
	FindBySTANPrefix(ctx context.Context, prefix string, limit int) ([]model.MastercardIPMTransaction, error)
	FindByBatchID(ctx context.Context, batchID primitive.ObjectID) ([]model.MastercardIPMTransaction, error)
	FindBySTAN(ctx context.Context, stan string) (*model.MastercardIPMTransaction, error)
	FindByPAN(ctx context.Context, pan string) ([]model.MastercardIPMTransaction, error)
	FindBatchSummaryByID(ctx context.Context, batchID string) (*model.MastercardIPMBatchSummary, error)
	ListBatchSummaries(ctx context.Context, limit int64) ([]model.MastercardIPMBatchSummary, error)
}
