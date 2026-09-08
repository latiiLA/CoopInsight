package migrations

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/db"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/repository/mongodb"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func init() {
	db.RegisterMigration(db.Migration{
		Version: 1,
		Name:    "indexes",
		Up:      upIndexes,
	})
}

func upIndexes(ctx context.Context, database *mongo.Database) error {
	if err := mongodb.EnsurePermissionIndexes(ctx, database); err != nil {
		return err
	}
	if err := mongodb.EnsureActivityLogIndexes(ctx, database); err != nil {
		return err
	}

	_, err := database.Collection("roles").Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "name", Value: 1}},
		Options: options.Index().
			SetName("uniq_role_name_active").
			SetUnique(true).
			SetPartialFilterExpression(bson.M{
				"status": model.RoleStatusActive,
			}),
	})
	if err != nil {
		return err
	}

	_, err = database.Collection("users").Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys: bson.D{{Key: "username", Value: 1}},
			Options: options.Index().
				SetName("uniq_user_username").
				SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "roleId", Value: 1}},
			Options: options.Index().SetName("idx_user_role_id"),
		},
	})
	return err
}
