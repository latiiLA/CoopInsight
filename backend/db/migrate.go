package db

import (
	"context"
	"fmt"
	"sort"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const migrationsCollection = "schema_migrations"

type Migration struct {
	Version int
	Name    string
	Up      func(ctx context.Context, db *mongo.Database) error
}

type SeedStep struct {
	Name string
	Run  func(ctx context.Context, db *mongo.Database) error
}

type appliedMigration struct {
	Version   int       `bson:"version"`
	Name      string    `bson:"name"`
	AppliedAt time.Time `bson:"appliedAt"`
}

var migrations []Migration
var seeds []SeedStep

func RegisterMigration(m Migration) {
	migrations = append(migrations, m)
}

func RegisterSeed(s SeedStep) {
	seeds = append(seeds, s)
}

func Up(ctx context.Context, database *mongo.Database) error {
	if err := ensureMigrationsCollection(ctx, database); err != nil {
		return err
	}

	applied, err := listApplied(ctx, database)
	if err != nil {
		return err
	}
	appliedSet := make(map[int]struct{}, len(applied))
	for _, row := range applied {
		appliedSet[row.Version] = struct{}{}
	}

	sorted := append([]Migration(nil), migrations...)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Version < sorted[j].Version
	})

	for _, m := range sorted {
		if _, ok := appliedSet[m.Version]; ok {
			fmt.Printf("skip migration %03d_%s (already applied)\n", m.Version, m.Name)
			continue
		}

		fmt.Printf("apply migration %03d_%s\n", m.Version, m.Name)
		if err := m.Up(ctx, database); err != nil {
			return fmt.Errorf("migration %03d_%s failed: %w", m.Version, m.Name, err)
		}

		_, err := database.Collection(migrationsCollection).InsertOne(ctx, appliedMigration{
			Version:   m.Version,
			Name:      m.Name,
			AppliedAt: time.Now().UTC(),
		})
		if err != nil {
			return fmt.Errorf("record migration %03d_%s: %w", m.Version, m.Name, err)
		}
	}

	return nil
}

func Seed(ctx context.Context, database *mongo.Database) error {
	sorted := append([]SeedStep(nil), seeds...)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Name < sorted[j].Name
	})

	for _, s := range sorted {
		fmt.Printf("run seed %s\n", s.Name)
		if err := s.Run(ctx, database); err != nil {
			return fmt.Errorf("seed %s failed: %w", s.Name, err)
		}
	}

	return nil
}

func Status(ctx context.Context, database *mongo.Database) error {
	if err := ensureMigrationsCollection(ctx, database); err != nil {
		return err
	}

	applied, err := listApplied(ctx, database)
	if err != nil {
		return err
	}
	appliedSet := make(map[int]appliedMigration, len(applied))
	for _, row := range applied {
		appliedSet[row.Version] = row
	}

	sorted := append([]Migration(nil), migrations...)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Version < sorted[j].Version
	})

	fmt.Println("Migrations:")
	for _, m := range sorted {
		if row, ok := appliedSet[m.Version]; ok {
			fmt.Printf("  [x] %03d_%s  applied %s\n", m.Version, m.Name, row.AppliedAt.Format(time.RFC3339))
			continue
		}
		fmt.Printf("  [ ] %03d_%s\n", m.Version, m.Name)
	}

	fmt.Println("Seeds (re-runnable):")
	seedList := append([]SeedStep(nil), seeds...)
	sort.Slice(seedList, func(i, j int) bool {
		return seedList[i].Name < seedList[j].Name
	})
	for _, s := range seedList {
		fmt.Printf("  - %s\n", s.Name)
	}

	return nil
}

func ensureMigrationsCollection(ctx context.Context, database *mongo.Database) error {
	_, err := database.Collection(migrationsCollection).Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "version", Value: 1}},
		Options: options.Index().SetName("uniq_schema_migration_version").SetUnique(true),
	})
	return err
}

func listApplied(ctx context.Context, database *mongo.Database) ([]appliedMigration, error) {
	cursor, err := database.Collection(migrationsCollection).Find(
		ctx,
		bson.M{},
		options.Find().SetSort(bson.D{{Key: "version", Value: 1}}),
	)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var rows []appliedMigration
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	return rows, nil
}
