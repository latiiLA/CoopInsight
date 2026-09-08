package seeds

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/db"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

const defaultBootstrapUsername = "systemadmin"

func init() {
	db.RegisterSeed(db.SeedStep{
		Name: "003_bootstrap_admin_user",
		Run:  seedBootstrapAdminUser,
	})
}

func seedBootstrapAdminUser(ctx context.Context, database *mongo.Database) error {
	username := strings.ToLower(strings.TrimSpace(os.Getenv("BOOTSTRAP_ADMIN_USERNAME")))
	if username == "" {
		username = defaultBootstrapUsername
	}

	password := strings.TrimSpace(os.Getenv("BOOTSTRAP_ADMIN_PASSWORD"))
	if password == "" {
		return fmt.Errorf("BOOTSTRAP_ADMIN_PASSWORD is required in the environment / .env")
	}
	if len(password) < 6 {
		return fmt.Errorf("BOOTSTRAP_ADMIN_PASSWORD must be at least 6 characters")
	}

	email := strings.ToLower(strings.TrimSpace(os.Getenv("BOOTSTRAP_ADMIN_EMAIL")))
	if email == "" {
		email = username + "@local"
	}

	role, err := findSuperAdminRole(ctx, database)
	if err != nil {
		return err
	}
	if role == nil {
		return fmt.Errorf("SUPERADMIN role not found; run permission/role seeds first")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash bootstrap password: %w", err)
	}

	users := database.Collection("users")
	now := time.Now().UTC()
	adminID := db.SystemAdminUserID

	// Move an earlier bootstrap user onto the fixed system admin id if needed.
	var existingByName model.User
	err = users.FindOne(ctx, bson.M{
		"username": username,
		"status": bson.M{
			"$ne": model.StatusDeleted,
		},
	}).Decode(&existingByName)
	if err == nil && existingByName.ID != adminID {
		if _, delErr := users.DeleteOne(ctx, bson.M{"_id": existingByName.ID}); delErr != nil {
			return fmt.Errorf("replace legacy bootstrap admin: %w", delErr)
		}
		fmt.Printf("  ~ moved legacy bootstrap user %s onto fixed system admin id\n", username)
	} else if err != nil && err != mongo.ErrNoDocuments {
		return fmt.Errorf("lookup bootstrap admin: %w", err)
	}

	filter := bson.M{"_id": adminID}
	update := bson.M{
		"$set": bson.M{
			"firstName":   "System",
			"middleName":  "Admin",
			"lastName":    "User",
			"email":       email,
			"username":    username,
			"password":    string(hash),
			"roleId":      role.ID,
			"permissions": []string{},
			"status":      model.StatusActive,
			"updatedAt":   now,
			"updatedBy":   adminID,
			"createdBy":   adminID,
		},
		"$setOnInsert": bson.M{
			"createdAt": now,
		},
	}

	result, err := users.UpdateOne(ctx, filter, update, options.Update().SetUpsert(true))
	if err != nil {
		return fmt.Errorf("upsert bootstrap admin %s: %w", username, err)
	}

	switch {
	case result.UpsertedCount > 0:
		fmt.Printf("  + created bootstrap admin user %s (id=%s, SUPERADMIN)\n", username, adminID.Hex())
	case result.ModifiedCount > 0:
		fmt.Printf("  ~ updated bootstrap admin user %s (SUPERADMIN)\n", username)
	default:
		fmt.Printf("  = bootstrap admin user %s unchanged\n", username)
	}

	return nil
}

func findSuperAdminRole(ctx context.Context, database *mongo.Database) (*model.Role, error) {
	var role model.Role
	err := database.Collection("roles").FindOne(ctx, bson.M{
		"name": bson.M{"$regex": "^SUPERADMIN$", "$options": "i"},
		"status": bson.M{
			"$ne": model.RoleStatusDeleted,
		},
	}).Decode(&role)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &role, nil
}
