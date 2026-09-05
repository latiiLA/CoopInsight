package database

import (
	"context"
	"fmt"

	"github.com/latiiLA/CoopInsight/backend/configs"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func ConnectMongoDB(ctx context.Context) (*mongo.Client, error) {
	return ConnectMongoDBWithURI(ctx, configs.MongoURL)
}

func ConnectMongoDBWithURI(ctx context.Context, uri string) (*mongo.Client, error) {
	clientOptions := options.Client().ApplyURI(uri)

	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		_ = client.Disconnect(ctx)

		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	return client, nil
}

func PingDatabase(ctx context.Context, db *mongo.Database) error {
	if db == nil {
		return fmt.Errorf("database is nil")
	}

	if err := db.RunCommand(ctx, bson.D{{Key: "ping", Value: 1}}).Err(); err != nil {
		return fmt.Errorf("failed to ping database %s: %w", db.Name(), err)
	}

	return nil
}

// OpenSourceMongo pings SOURCE_DB_NAME. When SOURCE_MONGO_URL differs from MONGO_URL,
// it returns a second client that the caller must disconnect. db is nil when disabled.
func OpenSourceMongo(ctx context.Context, appClient *mongo.Client) (*mongo.Client, *mongo.Database, error) {
	if !configs.SourceMongoEnabled {
		return nil, nil, nil
	}

	client := appClient
	var extraClient *mongo.Client

	if configs.SourceMongoURL != "" && configs.SourceMongoURL != configs.MongoURL {
		sourceClient, err := ConnectMongoDBWithURI(ctx, configs.SourceMongoURL)
		if err != nil {
			return nil, nil, err
		}

		extraClient = sourceClient
		client = sourceClient
	}

	db := client.Database(configs.SourceDBName)
	if err := PingDatabase(ctx, db); err != nil {
		if extraClient != nil {
			_ = extraClient.Disconnect(ctx)
		}

		return nil, nil, err
	}

	return extraClient, db, nil
}
