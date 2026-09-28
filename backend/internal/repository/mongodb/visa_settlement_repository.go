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
	transactionsCollection = "visa_settlement_transactions"
	batchSummaryCollection = "settlement_batch_summaries"
)

type visaSettlementRepository struct {
	db              *mongo.Database
	txCollection    *mongo.Collection
	batchCollection *mongo.Collection
}

// NewSettlementRepository creates a new instance of SettlementRepository.
func NewVisaSettlementRepository(db *mongo.Database) repository.VisaSettlementRepository {
	return &visaSettlementRepository{
		db:              db,
		txCollection:    db.Collection(transactionsCollection),
		batchCollection: db.Collection(batchSummaryCollection),
	}
}

// UpsertTransactions stores parsed records idempotently, keyed on transaction id.
//
// A settlement file can be uploaded more than once, and re-processing it must
// not create a second copy of every record: the same transaction would then be
// counted twice in any total. Each record is therefore upserted, and a record
// that already existed has its updated_at, last_seen_batch_id and seen_count
// advanced instead of being inserted again.
//
// The first sighting of an id is preserved: first_seen_batch_id and created_at
// are only ever set on insert, so a record's origin survives every re-upload.
//
// Returns how many were newly inserted and how many were already present.
func (r *visaSettlementRepository) UpsertTransactions(ctx context.Context, txs []model.VisaSettlementTransaction) (int, int, error) {
	if len(txs) == 0 {
		return 0, 0, nil
	}

	now := time.Now().UTC()
	models := make([]mongo.WriteModel, 0, len(txs))

	for i := range txs {
		tx := txs[i]

		// A record with no transaction id cannot be deduplicated, because
		// there is nothing to match it on. It is still stored, but it must not
		// be upserted on an empty key, which would collapse every such record
		// onto the same document.
		if strings.TrimSpace(tx.TransactionID) == "" {
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

		// The parsed document is written in full, because an upsert only
		// creates the fields named in the filter and the update. Naming just
		// the metadata here produced records that held a transaction id and
		// timestamps but none of the parsed data, which is what an earlier
		// attempt at this did.
		//
		// Marshalling the struct keeps the stored field names identical to the
		// original insert path, so this cannot drift from the model.
		raw, err := bson.Marshal(tx)
		if err != nil {
			return 0, 0, fmt.Errorf("failed to encode settlement record %s: %w", tx.TransactionID, err)
		}

		var set bson.M
		if err := bson.Unmarshal(raw, &set); err != nil {
			return 0, 0, fmt.Errorf("failed to read settlement record %s: %w", tx.TransactionID, err)
		}

		// _id is not part of an update document: MongoDB rejects it, and the
		// existing document keeps its own id anyway.
		delete(set, "_id")

		// These are owned by the repository rather than the parser, so they are
		// not taken from the marshalled struct.
		delete(set, "created_at")
		delete(set, "updated_at")
		delete(set, "first_seen_batch_id")
		delete(set, "last_seen_batch_id")
		delete(set, "seen_count")

		// created_at and first_seen_batch_id are set on insert only, so a
		// record's origin survives every later re-upload. The parsed values
		// themselves are refreshed on re-upload, so a corrected parse replaces
		// what was stored before.
		//
		// seen_count is deliberately not in $setOnInsert: MongoDB rejects an
		// update that touches the same path in both $setOnInsert and $inc, and
		// the increment has to apply on every sighting. On a fresh insert $inc
		// alone yields 1, which is the correct starting value.
		update := bson.M{
			"$setOnInsert": bson.M{
				"created_at":          now,
				"first_seen_batch_id": tx.BatchID,
			},
			"$set": set,
			"$inc": bson.M{"seen_count": 1},
		}

		set["last_seen_batch_id"] = tx.BatchID
		set["updated_at"] = now

		models = append(models, mongo.NewUpdateOneModel().
			SetFilter(bson.M{"transaction_id": tx.TransactionID}).
			SetUpdate(update).
			SetUpsert(true))
	}

	// Ordered: false so one bad record does not stop the rest.
	opts := options.BulkWrite().SetOrdered(false)

	result, err := r.txCollection.BulkWrite(ctx, models, opts)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to upsert settlement transactions: %w", err)
	}

	// UpsertedCount is the transaction-keyed records that were new, and
	// InsertedCount the ones with no transaction id, which are always new.
	// MatchedCount is the transaction-keyed records that already existed, so
	// those are the duplicates this upload skipped.
	inserted := int(result.UpsertedCount) + int(result.InsertedCount)
	duplicates := int(result.MatchedCount)

	return inserted, duplicates, nil
}

// SaveBatchSummary logs overall metadata for an uploaded file batch.
func (r *visaSettlementRepository) SaveBatchSummary(ctx context.Context, batch *model.SettlementBatchSummary) error {
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
	// UpdatedAt is always the write time, which for a summary is the moment the
	// outcome was known.
	batch.UpdatedAt = now

	_, err := r.batchCollection.InsertOne(ctx, batch)
	if err != nil {
		return fmt.Errorf("failed to save settlement batch summary: %w", err)
	}

	return nil
}

// FindByTransactionID fetches a specific transaction by its Visa Transaction ID.
// FindByTransactionIDPrefix returns records whose transaction id starts with
// the given text.
//
// A prefix match rather than an exact one, because the useful case is a
// truncated id read off a report or an exception list, and an exact lookup would
// return nothing for it. It is also the form MongoDB can serve from the
// transaction_id index. The search text is escaped, so it is matched literally
// and cannot act as a pattern.
func (r *visaSettlementRepository) FindByTransactionIDPrefix(
	ctx context.Context,
	prefix string,
	limit int,
) ([]model.VisaSettlementTransaction, error) {
	trimmed := strings.TrimSpace(prefix)
	if trimmed == "" {
		return []model.VisaSettlementTransaction{}, nil
	}

	filter := bson.M{
		"transaction_id": bson.M{
			"$regex":   "^" + regexp.QuoteMeta(trimmed),
			"$options": "i",
		},
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "transaction_id", Value: 1}}).
		SetLimit(int64(limit))

	cursor, err := r.txCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("search by transaction id: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	results := make([]model.VisaSettlementTransaction, 0, 16)
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode transaction search results: %w", err)
	}
	return results, nil
}

func (r *visaSettlementRepository) FindByTransactionID(ctx context.Context, transactionID string) (*model.VisaSettlementTransaction, error) {
	filter := bson.M{"transaction_id": transactionID}

	var tx model.VisaSettlementTransaction
	err := r.txCollection.FindOne(ctx, filter).Decode(&tx)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil // Return nil, nil when document is not found
		}
		return nil, fmt.Errorf("failed to find transaction by transaction_id %s: %w", transactionID, err)
	}

	return &tx, nil
}

func (r *visaSettlementRepository) FindByDateRange(ctx context.Context, startDate, endDate time.Time) ([]model.VisaSettlementTransaction, error) {
	start := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, time.UTC)
	end := time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 23, 59, 59, 999999999, time.UTC)

	filter := bson.M{
		"transaction_date": bson.M{
			"$gte": start,
			"$lte": end,
		},
	}

	// ✅ Use bson.D from the SAME driver package as options/mongo
	// OR the map form which avoids the marshal issue entirely:
	opts := options.Find().SetSort(bson.D{{Key: "transaction_date", Value: 1}})

	// Alternative that always works across versions:
	// opts := options.Find().SetSort(map[string]int{"transaction_date": 1})

	cursor, err := r.txCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find by date range: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var results []model.VisaSettlementTransaction
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode results: %w", err)
	}
	return results, nil
}

// FindByAccountNumber fetches all transactions for a given account number (newest first).
// FindByBatchID returns the records captured by a single upload.
//
// This is the only reliable way to see what a given file produced, because the
// parsed transaction date comes from the file's own header and can land in an
// unexpected year, so a date range search can miss an upload entirely.
func (r *visaSettlementRepository) FindByBatchID(ctx context.Context, batchID primitive.ObjectID) ([]model.VisaSettlementTransaction, error) {
	filter := bson.M{"batch_id": batchID}

	// Sorted by _id so the records come back in the order they appeared in the
	// file, since there is no sequence column to sort on.
	opts := options.Find().SetSort(bson.D{{Key: "_id", Value: 1}})

	cursor, err := r.txCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find by batch id: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var results []model.VisaSettlementTransaction
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode batch results: %w", err)
	}
	return results, nil
}

func (r *visaSettlementRepository) FindByAccountNumber(ctx context.Context, accountNumber string) ([]model.VisaSettlementTransaction, error) {
	filter := bson.M{"account_number": accountNumber}

	opts := options.Find().SetSort(bson.D{{Key: "transaction_date", Value: -1}})

	cursor, err := r.txCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find by account number: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var results []model.VisaSettlementTransaction
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode results: %w", err)
	}
	return results, nil
}

// FindBatchSummaryByID fetches a single batch summary by its ObjectID hex string.
func (r *visaSettlementRepository) FindBatchSummaryByID(ctx context.Context, batchID string) (*model.SettlementBatchSummary, error) {
	oid, err := primitive.ObjectIDFromHex(batchID)
	if err != nil {
		// Every stored batch is keyed by an ObjectID, so an id that is not one
		// cannot match anything. Reporting it as not found is honest; failing
		// the request with a decode error would not be.
		return nil, nil
	}

	filter := bson.M{"_id": oid}

	var result model.SettlementBatchSummary
	err = r.batchCollection.FindOne(ctx, filter).Decode(&result)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("find batch summary by id: %w", err)
	}
	return &result, nil
}

// ListBatchSummaries returns the most recent batch summaries (newest first).
func (r *visaSettlementRepository) ListBatchSummaries(ctx context.Context, limit int64) ([]model.SettlementBatchSummary, error) {
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

	var results []model.SettlementBatchSummary
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode results: %w", err)
	}
	return results, nil
}

// FindSettledTransactionIDs returns all transaction IDs that have been settled
// within the given date range. This is used to exclude settled transactions
// from the unsettled view.
func (r *visaSettlementRepository) FindSettledTransactionIDs(ctx context.Context, startDate, endDate time.Time) ([]string, error) {
	start := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, time.UTC)
	end := time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 23, 59, 59, 999999999, time.UTC)

	filter := bson.M{
		"transaction_date": bson.M{
			"$gte": start,
			"$lte": end,
		},
		"transaction_id": bson.M{"$exists": true, "$ne": ""},
	}

	// Use projection to only fetch transaction_id field
	opts := options.Find().
		SetProjection(bson.M{"transaction_id": 1}).
		SetSort(bson.D{{Key: "transaction_id", Value: 1}})

	cursor, err := r.txCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find settled transaction IDs: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var results []struct {
		TransactionID string `bson:"transaction_id"`
	}
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode settled transaction IDs: %w", err)
	}

	ids := make([]string, 0, len(results))
	for _, r := range results {
		if r.TransactionID != "" {
			ids = append(ids, r.TransactionID)
		}
	}

	return ids, nil
}

// FindAllSettledTransactionIDs returns all settled transaction IDs without
// any date filter. This is used for exclusion checks where the settlement
// file's transaction_date may not align with Oracle's TR_CONV_DATE.
func (r *visaSettlementRepository) FindAllSettledTransactionIDs(ctx context.Context) ([]string, error) {
	filter := bson.M{
		"transaction_id": bson.M{"$exists": true, "$ne": ""},
	}

	opts := options.Find().
		SetProjection(bson.M{"transaction_id": 1}).
		SetSort(bson.D{{Key: "transaction_id", Value: 1}})

	cursor, err := r.txCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find all settled transaction IDs: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var results []struct {
		TransactionID string `bson:"transaction_id"`
	}
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode all settled transaction IDs: %w", err)
	}

	ids := make([]string, 0, len(results))
	for _, r := range results {
		if r.TransactionID != "" {
			ids = append(ids, r.TransactionID)
		}
	}

	return ids, nil
}

// FindSettledTransactionIDsByIDs returns the subset of the given transaction
// IDs that exist in the settlement collection.
func (r *visaSettlementRepository) FindSettledTransactionIDsByIDs(ctx context.Context, transactionIDs []string) ([]string, error) {
	if len(transactionIDs) == 0 {
		return []string{}, nil
	}

	filter := bson.M{
		"transaction_id": bson.M{"$in": transactionIDs},
	}

	opts := options.Find().
		SetProjection(bson.M{"transaction_id": 1}).
		SetSort(bson.D{{Key: "transaction_id", Value: 1}})

	cursor, err := r.txCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find settled transaction IDs by IDs: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var results []struct {
		TransactionID string `bson:"transaction_id"`
	}
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode settled transaction IDs by IDs: %w", err)
	}

	ids := make([]string, 0, len(results))
	for _, r := range results {
		if r.TransactionID != "" {
			ids = append(ids, r.TransactionID)
		}
	}

	return ids, nil
}

// FindSettledTransactionsByIDs returns settlement records matching the given
// transaction IDs, including their transaction dates. This is used to match
// uncleared transactions against settlement records on both transaction ID
// and transaction date.
func (r *visaSettlementRepository) FindSettledTransactionsByIDs(ctx context.Context, transactionIDs []string) ([]model.VisaSettlementTransaction, error) {
	if len(transactionIDs) == 0 {
		return []model.VisaSettlementTransaction{}, nil
	}

	filter := bson.M{
		"transaction_id": bson.M{"$in": transactionIDs},
	}

	opts := options.Find().
		SetProjection(bson.M{"transaction_id": 1, "transaction_date": 1}).
		SetSort(bson.D{{Key: "transaction_id", Value: 1}})

	cursor, err := r.txCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find settled transactions by IDs: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var results []model.VisaSettlementTransaction
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode settled transactions by IDs: %w", err)
	}

	return results, nil
}

// EnsureIndexes creates essential indexes on the MongoDB collections for optimal query speed.
func (r *visaSettlementRepository) EnsureIndexes(ctx context.Context) error {
	txIndexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "transaction_id", Value: 1}},
			Options: options.Index().SetName("idx_transaction_id"),
		},
		{
			Keys:    bson.D{{Key: "transaction_date", Value: 1}},
			Options: options.Index().SetName("idx_transaction_date"),
		},
		{
			Keys:    bson.D{{Key: "account_number", Value: 1}},
			Options: options.Index().SetName("idx_account_number"),
		},
		{
			// Supports listing what a single upload captured.
			Keys:    bson.D{{Key: "batch_id", Value: 1}},
			Options: options.Index().SetName("idx_batch_id"),
		},
		{
			// The transaction id identifies a settlement record, so it is made
			// unique at the database level as well as in the upsert. This is the
			// backstop: even if two uploads race, the loser cannot create a
			// second copy.
			//
			// The partial filter only uses $type, because MongoDB rejects $ne and
			// $not inside a partial index expression. Blank ids are therefore not
			// excluded by the index, which is why the upsert never writes a
			// document with a missing or empty transaction id in the first place:
			// those are inserted rather than upserted.
			Keys: bson.D{{Key: "transaction_id", Value: 1}},
			Options: options.Index().
				SetName("uniq_transaction_id").
				SetUnique(true).
				SetPartialFilterExpression(bson.M{
					"transaction_id": bson.M{"$type": "string"},
				}),
		},
		{
			// Supports ordering a batch's records by when they were last touched.
			Keys:    bson.D{{Key: "updated_at", Value: -1}},
			Options: options.Index().SetName("idx_updated_at"),
		},
		{
			Keys:    bson.D{{Key: "acquirer_ref_number", Value: 1}},
			Options: options.Index().SetName("idx_acquirer_ref_number"),
		},
		{
			Keys: bson.D{
				{Key: "report_id", Value: 1},
				{Key: "cpd", Value: 1},
			},
			Options: options.Index().SetName("idx_report_id_cpd"),
		},
	}

	if _, err := r.txCollection.Indexes().CreateMany(ctx, txIndexes); err != nil {
		return fmt.Errorf("failed to create transaction indexes: %w", err)
	}

	batchIndexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "processed_at", Value: -1}},
			Options: options.Index().SetName("idx_processed_at"),
		},
	}

	if _, err := r.batchCollection.Indexes().CreateMany(ctx, batchIndexes); err != nil {
		return fmt.Errorf("failed to create batch indexes: %w", err)
	}

	return nil
}
