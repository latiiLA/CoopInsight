package mongodb

import (
	"context"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type activityLogRepository struct {
	collection *mongo.Collection
}

func NewActivityLogRepository(db *mongo.Database) repository.ActivityLogRepository {
	return &activityLogRepository{
		collection: db.Collection("activity_logs"),
	}
}

func EnsureActivityLogIndexes(ctx context.Context, db *mongo.Database) error {
	collection := db.Collection("activity_logs")
	_, err := collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "timestamp", Value: -1}},
			Options: options.Index().SetName("idx_activity_timestamp"),
		},
		{
			Keys: bson.D{
				{Key: "actorUserId", Value: 1},
				{Key: "timestamp", Value: -1},
			},
			Options: options.Index().SetName("idx_activity_actor_timestamp"),
		},
		{
			Keys: bson.D{
				{Key: "action", Value: 1},
				{Key: "timestamp", Value: -1},
			},
			Options: options.Index().SetName("idx_activity_action_timestamp"),
		},
	})
	return err
}

func (r *activityLogRepository) Create(ctx context.Context, entry *model.ActivityLog) error {
	if entry.ID.IsZero() {
		entry.ID = primitive.NewObjectID()
	}
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now().UTC()
	}
	_, err := r.collection.InsertOne(ctx, entry)
	return err
}

func (r *activityLogRepository) List(
	ctx context.Context,
	filter model.ActivityLogFilter,
) ([]model.ActivityLog, int64, error) {
	query := bson.M{}

	if !filter.From.IsZero() || !filter.To.IsZero() {
		rangeFilter := bson.M{}
		if !filter.From.IsZero() {
			rangeFilter["$gte"] = filter.From
		}
		if !filter.To.IsZero() {
			rangeFilter["$lt"] = filter.To
		}
		query["timestamp"] = rangeFilter
	}

	if actor := strings.TrimSpace(filter.Actor); actor != "" {
		if actorID, err := primitive.ObjectIDFromHex(actor); err == nil {
			query["actorUserId"] = actorID
		} else {
			query["actorUsername"] = bson.M{
				"$regex":   regexpEscape(actor),
				"$options": "i",
			}
		}
	}

	if action := strings.TrimSpace(filter.Action); action != "" {
		query["action"] = action
	}

	if q := strings.TrimSpace(filter.Query); q != "" {
		escaped := regexpEscape(q)
		query["$or"] = []bson.M{
			{"summary": bson.M{"$regex": escaped, "$options": "i"}},
			{"actorUsername": bson.M{"$regex": escaped, "$options": "i"}},
			{"resourceId": bson.M{"$regex": escaped, "$options": "i"}},
			{"action": bson.M{"$regex": escaped, "$options": "i"}},
		}
	}

	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 50
	}
	if pageSize > 200 {
		pageSize = 200
	}

	total, err := r.collection.CountDocuments(ctx, query)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "timestamp", Value: -1}}).
		SetSkip(int64((page - 1) * pageSize)).
		SetLimit(int64(pageSize))

	cursor, err := r.collection.Find(ctx, query, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	items := make([]model.ActivityLog, 0)
	if err := cursor.All(ctx, &items); err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

func regexpEscape(value string) string {
	replacer := strings.NewReplacer(
		`\`, `\\`,
		`.`, `\.`,
		`+`, `\+`,
		`*`, `\*`,
		`?`, `\?`,
		`^`, `\^`,
		`$`, `\$`,
		`[`, `\[`,
		`]`, `\]`,
		`(`, `\(`,
		`)`, `\)`,
		`{`, `\{`,
		`}`, `\}`,
		`|`, `\|`,
	)
	return replacer.Replace(value)
}
