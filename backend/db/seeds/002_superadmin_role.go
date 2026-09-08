package seeds

import (
	"context"
	"fmt"
	"time"

	"github.com/latiiLA/CoopInsight/backend/db"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const superAdminRoleName = "SUPERADMIN"

func init() {
	db.RegisterSeed(db.SeedStep{
		Name: "002_superadmin_role",
		Run:  seedSuperAdminRole,
	})
}

func seedSuperAdminRole(ctx context.Context, database *mongo.Database) error {
	collection := database.Collection("roles")
	now := time.Now().UTC()
	permissions := PermissionNames()
	actor := db.SystemAdminUserID

	filter := bson.M{
		"name": bson.M{"$regex": "^" + superAdminRoleName + "$", "$options": "i"},
		"status": bson.M{
			"$ne": model.RoleStatusDeleted,
		},
	}

	update := bson.M{
		"$set": bson.M{
			"name":        superAdminRoleName,
			"permissions": permissions,
			"status":      model.RoleStatusActive,
			"updatedAt":   now,
			"updatedBy":   actor,
			"createdBy":   actor,
		},
		"$setOnInsert": bson.M{
			"createdAt": now,
		},
	}

	result, err := collection.UpdateOne(
		ctx,
		filter,
		update,
		options.Update().SetUpsert(true),
	)
	if err != nil {
		return fmt.Errorf("upsert SUPERADMIN role: %w", err)
	}

	switch {
	case result.UpsertedCount > 0:
		fmt.Printf("  + created role %s with %d permissions (by systemadmin)\n", superAdminRoleName, len(permissions))
	case result.ModifiedCount > 0:
		fmt.Printf("  ~ synced role %s with %d permissions (by systemadmin)\n", superAdminRoleName, len(permissions))
	default:
		fmt.Printf("  = role %s already up to date (%d permissions)\n", superAdminRoleName, len(permissions))
	}

	return nil
}
