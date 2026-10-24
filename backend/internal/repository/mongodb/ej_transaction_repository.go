package mongodb

import (
	"context"
	"regexp"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type ejTransactionRepository struct {
	collection *mongo.Collection
}

func NewEJTransactionRepository(db *mongo.Database) repository.EJTransactionRepository {
	if db == nil {
		return &ejTransactionRepository{}
	}
	return &ejTransactionRepository{collection: db.Collection("ej_transactions")}
}

func EnsureEJIndexes(ctx context.Context, db *mongo.Database) error {
	if db == nil {
		return nil
	}
	txnRepo := NewEJTransactionRepository(db)
	fileRepo := NewEJFileRepository(db)
	if err := txnRepo.EnsureIndexes(ctx); err != nil {
		return err
	}
	return fileRepo.EnsureIndexes(ctx)
}

func (r *ejTransactionRepository) EnsureIndexes(ctx context.Context) error {
	if r.collection == nil {
		return nil
	}
	_, err := r.collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys: bson.D{
				{Key: "card_first4", Value: 1},
				{Key: "card_last4", Value: 1},
				{Key: "ej_date", Value: -1},
			},
			Options: options.Index().SetName("idx_ej_card_date"),
		},
		{
			Keys:    bson.D{{Key: "authnum", Value: 1}},
			Options: options.Index().SetName("idx_ej_authnum"),
		},
		{
			Keys: bson.D{
				{Key: "ej_date", Value: 1},
				{Key: "terminal_id", Value: 1},
			},
			Options: options.Index().SetName("idx_ej_date_terminal"),
		},
		{
			Keys: bson.D{
				{Key: "terminal_id", Value: 1},
				{Key: "filename", Value: 1},
			},
			Options: options.Index().SetName("idx_ej_terminal_filename"),
		},
	})
	return err
}

func (r *ejTransactionRepository) ReplaceFileTransactions(
	ctx context.Context,
	terminalID, filename string,
	txns []model.EJTransaction,
) error {
	if r.collection == nil {
		return common.ErrInternalServer
	}
	terminalID = strings.TrimSpace(terminalID)
	filename = strings.TrimSpace(filename)
	if terminalID == "" || filename == "" {
		return common.ErrEJSearchNeedsCriteria
	}

	if _, err := r.collection.DeleteMany(ctx, bson.M{
		"terminal_id": terminalID,
		"filename":    filename,
	}); err != nil {
		return err
	}
	if len(txns) == 0 {
		return nil
	}

	now := time.Now().UTC()
	docs := make([]any, 0, len(txns))
	for i := range txns {
		txn := txns[i]
		if txn.ID.IsZero() {
			txn.ID = primitive.NewObjectID()
		}
		txn.TerminalID = terminalID
		txn.Filename = filename
		txn.IndexedAt = now
		docs = append(docs, txn)
	}
	_, err := r.collection.InsertMany(ctx, docs)
	return err
}

func (r *ejTransactionRepository) AppendTransactions(
	ctx context.Context,
	terminalID, filename string,
	txns []model.EJTransaction,
) error {
	if r.collection == nil {
		return common.ErrInternalServer
	}
	if len(txns) == 0 {
		return nil
	}
	terminalID = strings.TrimSpace(terminalID)
	filename = strings.TrimSpace(filename)
	if terminalID == "" || filename == "" {
		return common.ErrEJSearchNeedsCriteria
	}

	now := time.Now().UTC()
	docs := make([]any, 0, len(txns))
	for i := range txns {
		txn := txns[i]
		if txn.ID.IsZero() {
			txn.ID = primitive.NewObjectID()
		}
		txn.TerminalID = terminalID
		txn.Filename = filename
		txn.IndexedAt = now
		docs = append(docs, txn)
	}
	_, err := r.collection.InsertMany(ctx, docs)
	return err
}

func (r *ejTransactionRepository) Search(
	ctx context.Context,
	req model.EJTransactionSearchRequest,
	page, pageSize int,
) ([]model.EJTransaction, bool, error) {
	if r.collection == nil {
		return nil, false, common.ErrInternalServer
	}
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 50
	}
	if pageSize > 500 {
		pageSize = 500
	}

	filter := bson.M{}
	if f4 := strings.TrimSpace(req.CardFirst4); f4 != "" {
		// Full 4: exact. Shorter BIN fragment: prefix match.
		if len(f4) >= 4 {
			filter["card_first4"] = f4[:4]
		} else {
			filter["card_first4"] = bson.M{
				"$regex":   "^" + regexp.QuoteMeta(f4),
				"$options": "",
			}
		}
	}
	if l4 := strings.TrimSpace(req.CardLast4); l4 != "" {
		// Full 4: exact. Shorter trailing (e.g. "...X7"): suffix match on last4.
		if len(l4) >= 4 {
			filter["card_last4"] = l4[len(l4)-4:]
		} else {
			filter["card_last4"] = bson.M{
				"$regex":   regexp.QuoteMeta(l4) + "$",
				"$options": "",
			}
		}
	}
	if term := strings.TrimSpace(req.Terminal); term != "" {
		filter["terminal_id"] = strings.ToUpper(term)
	}
	if auth := strings.TrimSpace(req.AuthNum); auth != "" {
		filter["authnum"] = auth
	}
	if status := strings.TrimSpace(req.Status); status != "" {
		filter["status"] = status
	}
	if req.Amount != nil {
		filter["amount"] = *req.Amount
	}
	if acct := strings.TrimSpace(req.CustomerAccount); acct != "" {
		filter["customer_account"] = acct
	}
	dateFrom := normalizeEJDate(req.DateFrom)
	dateTo := normalizeEJDate(req.DateTo)
	if dateFrom != "" || dateTo != "" {
		rangeFilter := bson.M{}
		if dateFrom != "" {
			rangeFilter["$gte"] = dateFrom
		}
		if dateTo != "" {
			rangeFilter["$lte"] = dateTo
		}
		filter["ej_date"] = rangeFilter
	}

	offset := int64((page - 1) * pageSize)
	limit := int64(pageSize + 1)
	opts := options.Find().
		SetSort(bson.D{
			{Key: "ej_date", Value: -1},
			{Key: "start_time", Value: -1},
			{Key: "_id", Value: -1},
		}).
		SetSkip(offset).
		SetLimit(limit)

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, false, err
	}
	defer func() { _ = cursor.Close(ctx) }()

	items := make([]model.EJTransaction, 0, pageSize)
	for cursor.Next(ctx) {
		var row model.EJTransaction
		if err := cursor.Decode(&row); err != nil {
			return nil, false, err
		}
		items = append(items, row)
	}
	if err := cursor.Err(); err != nil {
		return nil, false, err
	}

	hasMore := len(items) > pageSize
	if hasMore {
		items = items[:pageSize]
	}
	return items, hasMore, nil
}

func (r *ejTransactionRepository) GetByID(ctx context.Context, id string) (*model.EJTransaction, error) {
	if r.collection == nil {
		return nil, common.ErrInternalServer
	}
	oid, err := primitive.ObjectIDFromHex(strings.TrimSpace(id))
	if err != nil {
		return nil, common.ErrInvalidEJTransactionID
	}
	var row model.EJTransaction
	err = r.collection.FindOne(ctx, bson.M{"_id": oid}).Decode(&row)
	if err == mongo.ErrNoDocuments {
		return nil, common.ErrEJTransactionNotFound
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

type ejFileRepository struct {
	collection *mongo.Collection
}

func NewEJFileRepository(db *mongo.Database) repository.EJFileRepository {
	if db == nil {
		return &ejFileRepository{}
	}
	return &ejFileRepository{collection: db.Collection("ej_files")}
}

func (r *ejFileRepository) EnsureIndexes(ctx context.Context) error {
	if r.collection == nil {
		return nil
	}
	_, err := r.collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys: bson.D{
				{Key: "terminal_id", Value: 1},
				{Key: "filename", Value: 1},
			},
			Options: options.Index().SetName("uidx_ej_file_terminal_filename").SetUnique(true),
		},
	})
	return err
}

func (r *ejFileRepository) Find(ctx context.Context, terminalID, filename string) (*model.EJFile, error) {
	if r.collection == nil {
		return nil, common.ErrInternalServer
	}
	var row model.EJFile
	err := r.collection.FindOne(ctx, bson.M{
		"terminal_id": strings.TrimSpace(terminalID),
		"filename":    strings.TrimSpace(filename),
	}).Decode(&row)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *ejFileRepository) Upsert(ctx context.Context, file model.EJFile) error {
	if r.collection == nil {
		return common.ErrInternalServer
	}
	file.TerminalID = strings.TrimSpace(file.TerminalID)
	file.Filename = strings.TrimSpace(file.Filename)
	file.IndexedAt = time.Now().UTC()
	_, err := r.collection.UpdateOne(
		ctx,
		bson.M{"terminal_id": file.TerminalID, "filename": file.Filename},
		bson.M{"$set": bson.M{
			"terminal_id":   file.TerminalID,
			"filename":      file.Filename,
			"path":          file.Path,
			"mtime":         file.MTime,
			"size":          file.Size,
			"parsed_offset":  file.ParsedOffset,
			"lines_before":   file.LinesBefore,
			"schema_version": file.SchemaVersion,
			"atm_type":       file.AtmType,
			"txn_count":      file.TxnCount,
			"indexed_at":     file.IndexedAt,
		}},
		options.Update().SetUpsert(true),
	)
	return err
}

func (r *ejFileRepository) ListIndexedForDates(
	ctx context.Context,
	dateFrom, dateTo string,
) ([]model.EJFile, error) {
	if r.collection == nil {
		return nil, common.ErrInternalServer
	}
	dateFrom = normalizeEJDate(dateFrom)
	dateTo = normalizeEJDate(dateTo)
	if dateFrom == "" || dateTo == "" {
		return nil, common.ErrInvalidReportDate
	}
	from, err := time.ParseInLocation("2006-01-02", dateFrom, time.Local)
	if err != nil {
		return nil, common.ErrInvalidReportDate
	}
	to, err := time.ParseInLocation("2006-01-02", dateTo, time.Local)
	if err != nil {
		return nil, common.ErrInvalidReportDate
	}
	if to.Before(from) {
		return nil, common.ErrInvalidDateRange
	}

	or := make([]bson.M, 0, int(to.Sub(from).Hours()/24)+1)
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		prefix := d.Format("2006_01_02")
		or = append(or, bson.M{
			"filename": bson.M{
				"$regex":   "^" + regexp.QuoteMeta(prefix) + "_",
				"$options": "",
			},
		})
	}
	if len(or) == 0 {
		return []model.EJFile{}, nil
	}

	opts := options.Find().SetProjection(bson.M{
		"terminal_id": 1,
		"filename":    1,
		"path":        1,
		"size":        1,
		"txn_count":   1,
		"atm_type":    1,
		"indexed_at":  1,
	})
	cursor, err := r.collection.Find(ctx, bson.M{"$or": or}, opts)
	if err != nil {
		return nil, err
	}
	defer func() { _ = cursor.Close(ctx) }()

	out := make([]model.EJFile, 0)
	if err := cursor.All(ctx, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// normalizeEJDate accepts MM-DD-YYYY, MM/DD/YYYY, or YYYY-MM-DD → YYYY-MM-DD.
func normalizeEJDate(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	s = strings.ReplaceAll(s, "/", "-")
	parts := strings.Split(s, "-")
	if len(parts) != 3 {
		return s
	}
	// YYYY-MM-DD
	if len(parts[0]) == 4 {
		return parts[0] + "-" + parts[1] + "-" + parts[2]
	}
	// MM-DD-YYYY
	if len(parts[2]) == 4 {
		return parts[2] + "-" + parts[0] + "-" + parts[1]
	}
	return s
}
