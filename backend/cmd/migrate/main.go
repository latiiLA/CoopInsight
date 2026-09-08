package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/latiiLA/CoopInsight/backend/db"
	_ "github.com/latiiLA/CoopInsight/backend/db/migrations"
	_ "github.com/latiiLA/CoopInsight/backend/db/seeds"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/database"
	"go.mongodb.org/mongo-driver/mongo"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(2)
	}

	command := strings.ToLower(strings.TrimSpace(os.Args[1]))
	mongoURL, dbName := loadMongoEnv()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	client, err := database.ConnectMongoDBWithURI(ctx, mongoURL)
	if err != nil {
		fatalf("connect mongo: %v", err)
	}
	defer func() {
		_ = client.Disconnect(context.Background())
	}()

	databaseHandle := client.Database(dbName)
	fmt.Printf("database: %s\n", dbName)

	if err := run(ctx, command, databaseHandle); err != nil {
		fatalf("%v", err)
	}
}

func run(ctx context.Context, command string, databaseHandle *mongo.Database) error {
	switch command {
	case "up":
		if err := db.Up(ctx, databaseHandle); err != nil {
			return err
		}
		fmt.Println("migrations complete")
		return nil
	case "seed":
		if err := db.Seed(ctx, databaseHandle); err != nil {
			return err
		}
		fmt.Println("seeds complete")
		return nil
	case "status":
		return db.Status(ctx, databaseHandle)
	case "all":
		if err := db.Up(ctx, databaseHandle); err != nil {
			return err
		}
		if err := db.Seed(ctx, databaseHandle); err != nil {
			return err
		}
		fmt.Println("migrations and seeds complete")
		return nil
	default:
		printUsage()
		os.Exit(2)
		return nil
	}
}

func loadMongoEnv() (mongoURL, dbName string) {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found or couldn't load it, relying on environment variables")
	}

	mongoURL = strings.TrimSpace(os.Getenv("MONGO_URL"))
	if mongoURL == "" {
		fatalf("MONGO_URL is required")
	}

	dbName = strings.TrimSpace(os.Getenv("DB_NAME"))
	if dbName == "" {
		dbName = "coop_insights_db"
	}

	return mongoURL, dbName
}

func printUsage() {
	fmt.Fprintf(os.Stderr, `Usage:
  go run ./cmd/migrate up       Apply pending schema/index migrations
  go run ./cmd/migrate seed     Upsert permissions and SUPERADMIN role
  go run ./cmd/migrate status   Show migration status
  go run ./cmd/migrate all      Run up then seed

Uses MONGO_URL and DB_NAME from the environment / .env
`)
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "migrate: "+format+"\n", args...)
	os.Exit(1)
}
