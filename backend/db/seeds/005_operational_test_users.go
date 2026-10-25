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
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

// Default password for seeded role test users. Override with SEED_TEST_USER_PASSWORD.
// Password is applied only when a user is first created (re-seed does not reset it).
const defaultTestUserPassword = "Test@123"

type testUserSeed struct {
	Username   string
	FirstName  string
	MiddleName string
	LastName   string
	RoleName   string
}

func init() {
	db.RegisterSeed(db.SeedStep{
		Name: "005_operational_test_users",
		Run:  seedOperationalTestUsers,
	})
}

func operationalTestUsers() []testUserSeed {
	return []testUserSeed{
		{Username: "payswitch", FirstName: "Pay", MiddleName: "Switch", LastName: "Tester", RoleName: "PAYSWITCH"},
		{Username: "payrecon", FirstName: "Pay", MiddleName: "Recon", LastName: "Tester", RoleName: "PAYRECON"},
		{Username: "accountsrecon", FirstName: "Accounts", MiddleName: "Recon", LastName: "Tester", RoleName: "ACCOUNTSRECON"},
		{Username: "card", FirstName: "Card", MiddleName: "Ops", LastName: "Tester", RoleName: "CARD"},
		{Username: "atmmonitoring", FirstName: "ATM", MiddleName: "Monitor", LastName: "Tester", RoleName: "ATMMONITORING"},
		{Username: "posmonitoring", FirstName: "POS", MiddleName: "Monitor", LastName: "Tester", RoleName: "POSMONITORING"},
	}
}

func seedOperationalTestUsers(ctx context.Context, database *mongo.Database) error {
	password := strings.TrimSpace(os.Getenv("SEED_TEST_USER_PASSWORD"))
	if password == "" {
		password = defaultTestUserPassword
	}
	if len(password) < 6 {
		return fmt.Errorf("SEED_TEST_USER_PASSWORD must be at least 6 characters")
	}

	users := database.Collection("users")
	roles := database.Collection("roles")
	now := time.Now().UTC()
	actor := db.SystemAdminUserID

	for _, item := range operationalTestUsers() {
		var role model.Role
		err := roles.FindOne(ctx, bson.M{
			"name": bson.M{"$regex": "^" + item.RoleName + "$", "$options": "i"},
			"status": bson.M{
				"$ne": model.RoleStatusDeleted,
			},
		}).Decode(&role)
		if err == mongo.ErrNoDocuments {
			return fmt.Errorf("role %s not found; run 004_operational_roles first", item.RoleName)
		}
		if err != nil {
			return fmt.Errorf("lookup role %s: %w", item.RoleName, err)
		}

		username := strings.ToLower(strings.TrimSpace(item.Username))
		email := username + "@local"

		var existing model.User
		err = users.FindOne(ctx, bson.M{
			"username": username,
			"status": bson.M{
				"$ne": model.StatusDeleted,
			},
		}).Decode(&existing)
		exists := err == nil
		if err != nil && err != mongo.ErrNoDocuments {
			return fmt.Errorf("lookup test user %s: %w", username, err)
		}

		setFields := bson.M{
			"firstName":   item.FirstName,
			"middleName":  item.MiddleName,
			"lastName":    item.LastName,
			"email":       email,
			"username":    username,
			"roleId":      role.ID,
			"permissions": []string{},
			"status":      model.StatusActive,
			"updatedAt":   now,
			"updatedBy":   actor,
			"createdBy":   actor,
		}
		setOnInsert := bson.M{
			"createdAt": now,
		}

		filter := bson.M{"username": username}
		if exists {
			filter = bson.M{"_id": existing.ID}
		} else {
			hash, hashErr := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
			if hashErr != nil {
				return fmt.Errorf("hash password for %s: %w", username, hashErr)
			}
			setFields["password"] = string(hash)
			setOnInsert["_id"] = primitive.NewObjectID()
		}

		result, upsertErr := users.UpdateOne(
			ctx,
			filter,
			bson.M{
				"$set":         setFields,
				"$setOnInsert": setOnInsert,
			},
			options.Update().SetUpsert(true),
		)
		if upsertErr != nil {
			return fmt.Errorf("upsert test user %s: %w", username, upsertErr)
		}

		switch {
		case result.UpsertedCount > 0:
			fmt.Printf("  + created test user %s (role %s)\n", username, item.RoleName)
		case result.ModifiedCount > 0:
			fmt.Printf("  ~ updated test user %s (role %s; password unchanged)\n", username, item.RoleName)
		default:
			fmt.Printf("  = test user %s unchanged (role %s)\n", username, item.RoleName)
		}
	}

	fmt.Printf("  i test users share password from SEED_TEST_USER_PASSWORD (default %s); set only on create\n", defaultTestUserPassword)
	return nil
}
