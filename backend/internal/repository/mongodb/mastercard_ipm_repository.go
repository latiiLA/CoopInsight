package mongodb

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	ipmTransactionsCollection = "mastercard_ipm_transactions"
	ipmBatchSummaryCollection = "mastercard_ipm_batch_summaries"
)

type mastercardIPMRepository struct {
	db              *mongo.Database
	txCollection    *mongo.Collection
	batchCollection *mongo.Collection
}

// NewMastercardIPMRepository creates a new instance of MastercardIPMRepository.
func NewMastercardIPMRepository(db *mongo.Database) repository.MastercardIPMRepository {
	return &mastercardIPMRepository{
		db:              db,
		txCollection:    db.Collection(ipmTransactionsCollection),
		batchCollection: db.Collection(ipmBatchSummaryCollection),
	}
}

func (r *mastercardIPMRepository) UpsertTransactions(ctx context.Context, txs []model.MastercardIPMTransaction) (int, int, error) {
	if len(txs) == 0 {
		return 0, 0, nil
	}

	now := time.Now().UTC()
	models := make([]mongo.WriteModel, 0, len(txs))

	for i := range txs {
		tx := txs[i]

		// Without a business key we cannot deduplicate safely.
		if strings.TrimSpace(tx.BusinessKey) == "" {
			if tx.ID.IsZero() {
				tx.ID = primitive.NewObjectID()
			}
			if tx.CreatedAt.IsZero() {
				tx.CreatedAt = now
			}
			tx.UpdatedAt = now
			tx.SeenCount = 1
			tx.LastSeenBatchID = tx.BatchID

			models = append(models, mongo.NewInsertOneModel().SetDocument(tx))
			continue
		}

		if tx.ID.IsZero() {
			tx.ID = primitive.NewObjectID()
		}

		raw, err := bson.Marshal(tx)
		if err != nil {
			return 0, 0, fmt.Errorf("failed to encode IPM record %s: %w", tx.BusinessKey, err)
		}

		var set bson.M
		if err := bson.Unmarshal(raw, &set); err != nil {
			return 0, 0, fmt.Errorf("failed to read IPM record %s: %w", tx.BusinessKey, err)
		}

		delete(set, "_id")
		delete(set, "created_at")
		delete(set, "updated_at")
		delete(set, "batch_id") // keep original capture batch immutable
		delete(set, "first_seen_batch_id")
		delete(set, "last_seen_batch_id")
		delete(set, "seen_count")

		update := bson.M{
			"$setOnInsert": bson.M{
				"created_at":          now,
				"batch_id":            tx.BatchID,
				"first_seen_batch_id": tx.BatchID,
			},
			"$set": set,
			"$inc": bson.M{"seen_count": 1},
		}

		set["last_seen_batch_id"] = tx.BatchID
		set["updated_at"] = now

		models = append(models, mongo.NewUpdateOneModel().
			SetFilter(bson.M{"business_key": tx.BusinessKey}).
			SetUpdate(update).
			SetUpsert(true))
	}

	opts := options.BulkWrite().SetOrdered(false)

	result, err := r.txCollection.BulkWrite(ctx, models, opts)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to upsert IPM transactions: %w", err)
	}

	inserted := int(result.UpsertedCount) + int(result.InsertedCount)
	duplicates := int(result.MatchedCount)

	return inserted, duplicates, nil
}

func (r *mastercardIPMRepository) SaveBatchSummary(ctx context.Context, batch *model.MastercardIPMBatchSummary) error {
	now := time.Now().UTC()

	if batch.ID.IsZero() {
		batch.ID = primitive.NewObjectID()
	}
	if batch.CreatedAt.IsZero() {
		batch.CreatedAt = now
	}
	if batch.ProcessedAt.IsZero() {
		batch.ProcessedAt = now
	}
	batch.UpdatedAt = now

	_, err := r.batchCollection.InsertOne(ctx, batch)
	if err != nil {
		return fmt.Errorf("failed to save IPM batch summary: %w", err)
	}

	return nil
}

func (r *mastercardIPMRepository) FindBySTANPrefix(ctx context.Context, prefix string, limit int) ([]model.MastercardIPMTransaction, error) {
	trimmed := strings.TrimSpace(prefix)
	if trimmed == "" {
		return []model.MastercardIPMTransaction{}, nil
	}

	filter := bson.M{
		"stan": bson.M{
			"$regex":   "^" + regexp.QuoteMeta(trimmed),
			"$options": "i",
		},
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "stan", Value: 1}}).
		SetLimit(int64(limit))

	cursor, err := r.txCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("search by STAN: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	results := make([]model.MastercardIPMTransaction, 0, 16)
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode STAN search results: %w", err)
	}
	return results, nil
}

func (r *mastercardIPMRepository) FindBySTAN(ctx context.Context, stan string) (*model.MastercardIPMTransaction, error) {
	filter := bson.M{"stan": stan}

	var tx model.MastercardIPMTransaction
	err := r.txCollection.FindOne(ctx, filter).Decode(&tx)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find by STAN %s: %w", stan, err)
	}

	return &tx, nil
}

func (r *mastercardIPMRepository) FindByDateRange(ctx context.Context, startDate, endDate time.Time) ([]model.MastercardIPMTransaction, error) {
	start := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, time.UTC)
	end := time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 23, 59, 59, 999999999, time.UTC)

	filter := bson.M{
		"transaction_date": bson.M{
			"$gte": start,
			"$lte": end,
		},
	}

	opts := options.Find().SetSort(bson.D{{Key: "transaction_date", Value: 1}})

	cursor, err := r.txCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find by date range: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var results []model.MastercardIPMTransaction
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode results: %w", err)
	}
	return results, nil
}
func (r *mastercardIPMRepository) FindSettlementSummariesByDateRange(ctx context.Context, startDate, endDate time.Time) ([]model.MastercardIPMTransaction, error) {
	start := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, time.UTC)
	end := time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 23, 59, 59, 999999999, time.UTC)

	filter := bson.M{
		"transaction_date": bson.M{
			"$gte": start,
			"$lte": end,
		},
		"$or": []bson.M{
			{"message_type": model.IPMMessageSettlementSummary},
			{"function_code": bson.M{"$in": []string{"680", "685", "688"}}},
		},
	}

	opts := options.Find().SetSort(bson.D{
		{Key: "transaction_date", Value: 1},
		{Key: "function_code", Value: 1},
		{Key: "message_number", Value: 1},
	})

	cursor, err := r.txCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find settlement summaries by date range: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var results []model.MastercardIPMTransaction
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode settlement summaries: %w", err)
	}
	return results, nil
}

func (r *mastercardIPMRepository) FindByBatchID(ctx context.Context, batchID primitive.ObjectID) ([]model.MastercardIPMTransaction, error) {
	// Include last_seen so re-uploads still list rows that were first captured
	// in an older batch but seen again in this one.
	filter := bson.M{
		"$or": []bson.M{
			{"batch_id": batchID},
			{"last_seen_batch_id": batchID},
		},
	}
	opts := options.Find().SetSort(bson.D{{Key: "_id", Value: 1}})

	cursor, err := r.txCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find by batch id: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var results []model.MastercardIPMTransaction
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode batch results: %w", err)
	}
	return results, nil
}

func (r *mastercardIPMRepository) FindByPAN(ctx context.Context, pan string) ([]model.MastercardIPMTransaction, error) {
	filter := bson.M{"pan": pan}
	opts := options.Find().SetSort(bson.D{{Key: "transaction_date", Value: -1}})

	cursor, err := r.txCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find by PAN: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var results []model.MastercardIPMTransaction
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode results: %w", err)
	}
	return results, nil
}

func (r *mastercardIPMRepository) FindBatchSummaryByID(ctx context.Context, batchID string) (*model.MastercardIPMBatchSummary, error) {
	oid, err := primitive.ObjectIDFromHex(batchID)
	if err != nil {
		return nil, nil
	}

	filter := bson.M{"_id": oid}

	var result model.MastercardIPMBatchSummary
	err = r.batchCollection.FindOne(ctx, filter).Decode(&result)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("find batch summary by id: %w", err)
	}
	return &result, nil
}

func (r *mastercardIPMRepository) ListBatchSummaries(ctx context.Context, limit int64) ([]model.MastercardIPMBatchSummary, error) {
	if limit <= 0 {
		limit = 20
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "processed_at", Value: -1}}).
		SetLimit(limit)

	cursor, err := r.batchCollection.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, fmt.Errorf("list batch summaries: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var results []model.MastercardIPMBatchSummary
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode results: %w", err)
	}
	return results, nil
}

func (r *mastercardIPMRepository) EnsureIndexes(ctx context.Context) error {
	// Drop the earlier WIP unique index on STAN alone; clearing admin messages
	// have no STAN and a STAN-only key is not a stable settlement identity.
	_, _ = r.txCollection.Indexes().DropOne(ctx, "uniq_ipm_stan")

	txIndexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "business_key", Value: 1}},
			Options: options.Index().SetName("idx_ipm_business_key"),
		},
		{
			Keys: bson.D{{Key: "business_key", Value: 1}},
			Options: options.Index().
				SetName("uniq_ipm_business_key").
				SetUnique(true).
				SetPartialFilterExpression(bson.M{
					"business_key": bson.M{"$type": "string"},
				}),
		},
		{
			Keys:    bson.D{{Key: "stan", Value: 1}},
			Options: options.Index().SetName("idx_ipm_stan"),
		},
		{
			Keys:    bson.D{{Key: "transaction_date", Value: 1}},
			Options: options.Index().SetName("idx_ipm_transaction_date"),
		},
		{
			Keys:    bson.D{{Key: "pan", Value: 1}},
			Options: options.Index().SetName("idx_ipm_pan"),
		},
		{
			Keys:    bson.D{{Key: "batch_id", Value: 1}},
			Options: options.Index().SetName("idx_ipm_batch_id"),
		},
		{
			Keys:    bson.D{{Key: "file_id", Value: 1}, {Key: "message_number", Value: 1}},
			Options: options.Index().SetName("idx_ipm_file_id_message_number"),
		},
		{
			Keys:    bson.D{{Key: "function_code", Value: 1}},
			Options: options.Index().SetName("idx_ipm_function_code"),
		},
		{
			Keys:    bson.D{{Key: "updated_at", Value: -1}},
			Options: options.Index().SetName("idx_ipm_updated_at"),
		},
	}

	if _, err := r.txCollection.Indexes().CreateMany(ctx, txIndexes); err != nil {
		return fmt.Errorf("failed to create IPM transaction indexes: %w", err)
	}

	batchIndexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "processed_at", Value: -1}},
			Options: options.Index().SetName("idx_ipm_processed_at"),
		},
		{
			Keys:    bson.D{{Key: "file_id", Value: 1}},
			Options: options.Index().SetName("idx_ipm_batch_file_id"),
		},
	}

	if _, err := r.batchCollection.Indexes().CreateMany(ctx, batchIndexes); err != nil {
		return fmt.Errorf("failed to create IPM batch indexes: %w", err)
	}

	return nil
}
