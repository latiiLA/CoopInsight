package seeds

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/db"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type permissionSeed struct {
	Name        string
	Resource    string
	Action      string
	Description string
}

// Catalog is the single source of truth for app permissions.
var Catalog = []permissionSeed{
	{Name: "user:view", Resource: "user", Action: "view", Description: "List users"},
	{Name: "user:view-details", Resource: "user", Action: "view-details", Description: "View user details"},
	{Name: "user:create", Resource: "user", Action: "create", Description: "Create users and fulfill account requests"},
	{Name: "user:update", Resource: "user", Action: "update", Description: "Update users"},
	{Name: "user:delete", Resource: "user", Action: "delete", Description: "Delete users"},

	{Name: "role:view", Resource: "role", Action: "view", Description: "List roles"},
	{Name: "role:view-details", Resource: "role", Action: "view-details", Description: "View role details"},
	{Name: "role:create", Resource: "role", Action: "create", Description: "Create roles"},
	{Name: "role:update", Resource: "role", Action: "update", Description: "Update roles"},
	{Name: "role:delete", Resource: "role", Action: "delete", Description: "Delete roles"},

	{Name: "permission:view", Resource: "permission", Action: "view", Description: "List permissions"},
	{Name: "permission:view-details", Resource: "permission", Action: "view-details", Description: "View permission details"},
	{Name: "permission:create", Resource: "permission", Action: "create", Description: "Create permissions"},
	{Name: "permission:update", Resource: "permission", Action: "update", Description: "Update permissions"},
	{Name: "permission:delete", Resource: "permission", Action: "delete", Description: "Delete permissions"},

	{Name: "report:view-deposit-per-terminal", Resource: "report", Action: "view-deposit-per-terminal", Description: "View deposit per terminal report"},
	{Name: "report:view-success-transactions", Resource: "report", Action: "view-success-transactions", Description: "View acquiring success rate report"},
	{Name: "report:view-ebirr-cardless-withdrawal", Resource: "report", Action: "view-ebirr-cardless-withdrawal", Description: "View Ebirr cardless withdrawal report"},

	{Name: "monitoring:view-onus", Resource: "monitoring", Action: "view-onus", Description: "View on-us live monitoring"},
	{Name: "monitoring:view-offus", Resource: "monitoring", Action: "view-offus", Description: "View off-us live monitoring"},
	{Name: "monitoring:view-mastercard-debit", Resource: "monitoring", Action: "view-mastercard-debit", Description: "View Mastercard debit monitoring"},
	{Name: "monitoring:view-mastercard-credit", Resource: "monitoring", Action: "view-mastercard-credit", Description: "View Mastercard credit monitoring"},
	{Name: "monitoring:view-visa", Resource: "monitoring", Action: "view-visa", Description: "View Visa monitoring"},
	{Name: "monitoring:run-switch", Resource: "monitoring", Action: "run-switch", Description: "Run switch commands such as load_atm"},

	{Name: "terminal:view-atm", Resource: "terminal", Action: "view-atm", Description: "View ATM fleet and dashboard"},
	{Name: "terminal:view-pos", Resource: "terminal", Action: "view-pos", Description: "View POS fleet and dashboard"},
	{Name: "terminal:view-atm-transaction", Resource: "terminal", Action: "view-atm-transaction", Description: "View ATM transactions and comparison"},
	{Name: "terminal:view-pos-transaction", Resource: "terminal", Action: "view-pos-transaction", Description: "View POS transactions and comparison"},

	{Name: "activity:view", Resource: "activity", Action: "view", Description: "View activity log"},
}

func init() {
	db.RegisterSeed(db.SeedStep{
		Name: "001_permissions",
		Run:  seedPermissions,
	})
}

func PermissionNames() []string {
	names := make([]string, 0, len(Catalog))
	for _, item := range Catalog {
		names = append(names, item.Name)
	}
	return names
}

func seedPermissions(ctx context.Context, database *mongo.Database) error {
	collection := database.Collection("permissions")
	now := time.Now().UTC()
	actor := db.SystemAdminUserID

	for _, item := range Catalog {
		name := strings.ToLower(strings.TrimSpace(item.Name))
		resource := strings.ToLower(strings.TrimSpace(item.Resource))
		action := strings.ToLower(strings.TrimSpace(item.Action))

		filter := bson.M{
			"name": name,
			"status": bson.M{
				"$ne": model.PermissionStatusDeleted,
			},
		}

		update := bson.M{
			"$set": bson.M{
				"name":        name,
				"resource":    resource,
				"action":      action,
				"description": item.Description,
				"status":      model.PermissionStatusActive,
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
			return fmt.Errorf("upsert permission %s: %w", name, err)
		}

		switch {
		case result.UpsertedCount > 0:
			fmt.Printf("  + created permission %s (by systemadmin)\n", name)
		case result.ModifiedCount > 0:
			fmt.Printf("  ~ updated permission %s (by systemadmin)\n", name)
		default:
			fmt.Printf("  = permission %s unchanged\n", name)
		}
	}

	return nil
}
