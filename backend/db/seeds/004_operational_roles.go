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

type operationalRoleSeed struct {
	Name        string
	Permissions []string
}

func init() {
	db.RegisterSeed(db.SeedStep{
		Name: "004_operational_roles",
		Run:  seedOperationalRoles,
	})
}

func catalogByPrefix(prefixes ...string) []string {
	out := make([]string, 0)
	for _, item := range Catalog {
		for _, prefix := range prefixes {
			if strings.HasPrefix(item.Name, prefix) {
				out = append(out, item.Name)
				break
			}
		}
	}
	return out
}

func catalogNamed(names ...string) []string {
	wanted := make(map[string]struct{}, len(names))
	for _, name := range names {
		wanted[name] = struct{}{}
	}
	out := make([]string, 0, len(names))
	for _, item := range Catalog {
		if _, ok := wanted[item.Name]; ok {
			out = append(out, item.Name)
		}
	}
	return out
}

func mergeUnique(slices ...[]string) []string {
	seen := make(map[string]struct{})
	out := make([]string, 0)
	for _, slice := range slices {
		for _, name := range slice {
			if _, ok := seen[name]; ok {
				continue
			}
			seen[name] = struct{}{}
			out = append(out, name)
		}
	}
	return out
}

func operationalRoleSeeds() []operationalRoleSeed {
	switchSuccessRates := catalogNamed(
		"report:view-success-transactions",
		"report:browse-success-transactions",
		"report:view-switch-overall-success-rate",
		"report:view-switch-onus-success-rate",
		"report:view-switch-offus-success-rate",
		"report:view-switch-remote-onus-success-rate",
		"report:view-switch-issuing-success-rate",
		"report:view-atm-overall-success-rate",
		"report:view-atm-acquiring-success-rate",
		"report:view-atm-onus-success-rate",
		"report:view-atm-offus-success-rate",
		"report:view-atm-issuing-success-rate",
		"report:view-pos-overall-success-rate",
		"report:view-pos-acquiring-success-rate",
		"report:view-pos-onus-success-rate",
		"report:view-pos-offus-success-rate",
		"report:view-pos-issuing-success-rate",
	)

	// ATM monitoring: all ATM success-rate views + browse.
	// Terminal success rate page is gated by the acquiring permission.
	// Do not grant report:view-success-transactions; that legacy alias unlocks
	// Switch/POS entries when OR'd in the UI.
	atmSuccessRates := catalogNamed(
		"report:browse-success-transactions",
		"report:view-atm-overall-success-rate",
		"report:view-atm-acquiring-success-rate",
		"report:view-atm-onus-success-rate",
		"report:view-atm-offus-success-rate",
		"report:view-atm-issuing-success-rate",
	)

	posSuccessRates := catalogNamed(
		"report:browse-success-transactions",
		"report:view-pos-overall-success-rate",
		"report:view-pos-acquiring-success-rate",
		"report:view-pos-onus-success-rate",
		"report:view-pos-offus-success-rate",
		"report:view-pos-issuing-success-rate",
	)

	allReports := catalogNamed(
		"report:view-deposit-per-terminal",
		"report:view-ebirr-cardless-withdrawal",
		"report:view-transaction-mix",
		"report:search-cortex-transactions",
		"report:search-switch-transactions",
		"report:view-alpha-response",
		"report:export-switch-terminal-recon",
		"report:export-cortex-terminal-recon",
	)

	reportsExceptMix := catalogNamed(
		"report:view-deposit-per-terminal",
		"report:view-ebirr-cardless-withdrawal",
		"report:search-cortex-transactions",
		"report:search-switch-transactions",
		"report:view-alpha-response",
		"report:export-switch-terminal-recon",
		"report:export-cortex-terminal-recon",
	)

	return []operationalRoleSeed{
		{
			Name: "PAYSWITCH",
			Permissions: mergeUnique(
				switchSuccessRates,
				allReports,
				catalogByPrefix("monitoring:"),
				catalogByPrefix("terminal:"),
				catalogByPrefix("card:"),
			),
		},
		{
			Name: "PAYRECON",
			Permissions: mergeUnique(
				catalogByPrefix("settlement:"),
				catalogByPrefix("clearing:"),
				catalogByPrefix("card:"),
				catalogNamed(
					"report:search-switch-transactions",
					"report:search-cortex-transactions",
					"report:view-alpha-response",
					"report:export-switch-terminal-recon",
					"report:export-cortex-terminal-recon",
				),
			),
		},
		{
			Name: "ACCOUNTSRECON",
			Permissions: mergeUnique(
				catalogByPrefix("settlement:"),
				catalogByPrefix("clearing:"),
				catalogNamed(
					"report:search-ej-transactions",
					"report:search-switch-transactions",
					"report:view-alpha-response",
					"report:export-switch-terminal-recon",
				),
			),
		},
		{
			Name: "CARD",
			Permissions: mergeUnique(
				catalogByPrefix("card:"),
				catalogNamed(
					"report:search-switch-transactions",
					"report:view-card-product-success-rate",
				),
			),
		},
		{
			Name: "ATMMONITORING",
			Permissions: mergeUnique(
				atmSuccessRates,
				reportsExceptMix,
				catalogNamed(
					"terminal:view-atm",
					"terminal:view-atm-transaction",
				),
			),
		},
		{
			Name: "POSMONITORING",
			Permissions: mergeUnique(
				posSuccessRates,
				catalogNamed(
					"terminal:view-pos",
					"terminal:view-pos-transaction",
				),
			),
		},
	}
}

func seedOperationalRoles(ctx context.Context, database *mongo.Database) error {
	collection := database.Collection("roles")
	now := time.Now().UTC()
	actor := db.SystemAdminUserID

	for _, role := range operationalRoleSeeds() {
		filter := bson.M{
			"name": bson.M{"$regex": "^" + role.Name + "$", "$options": "i"},
			"status": bson.M{
				"$ne": model.RoleStatusDeleted,
			},
		}

		update := bson.M{
			"$set": bson.M{
				"name":        role.Name,
				"permissions": role.Permissions,
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
			return fmt.Errorf("upsert role %s: %w", role.Name, err)
		}

		switch {
		case result.UpsertedCount > 0:
			fmt.Printf("  + created role %s with %d permissions (by systemadmin)\n", role.Name, len(role.Permissions))
		case result.ModifiedCount > 0:
			fmt.Printf("  ~ synced role %s with %d permissions (by systemadmin)\n", role.Name, len(role.Permissions))
		default:
			fmt.Printf("  = role %s already up to date (%d permissions)\n", role.Name, len(role.Permissions))
		}
	}

	return nil
}
