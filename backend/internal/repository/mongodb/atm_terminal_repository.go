package mongodb

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type atmTerminalRepository struct {
	collection *mongo.Collection
}

func NewAtmTerminalRepository(db *mongo.Database) repository.AtmTerminalRepository {
	return &atmTerminalRepository{
		collection: db.Collection("terminals"),
	}
}

func (r *atmTerminalRepository) FindAll(ctx context.Context) ([]model.AtmTerminal, error) {
	pipeline := mongo.Pipeline{
		bson.D{{Key: "$lookup", Value: bson.D{
			{Key: "from", Value: "branches"},
			{Key: "localField", Value: "branchName"},
			{Key: "foreignField", Value: "_id"},
			{Key: "as", Value: "branchDoc"},
		}}},
		bson.D{{Key: "$lookup", Value: bson.D{
			{Key: "from", Value: "districts"},
			{Key: "localField", Value: "district"},
			{Key: "foreignField", Value: "_id"},
			{Key: "as", Value: "districtDoc"},
		}}},
		bson.D{{Key: "$unwind", Value: bson.D{
			{Key: "path", Value: "$branchDoc"},
			{Key: "preserveNullAndEmptyArrays", Value: true},
		}}},
		bson.D{{Key: "$unwind", Value: bson.D{
			{Key: "path", Value: "$districtDoc"},
			{Key: "preserveNullAndEmptyArrays", Value: true},
		}}},
		bson.D{{Key: "$project", Value: bson.D{
			{Key: "_id", Value: 1},
			{Key: "unitId", Value: 1},
			{Key: "type", Value: 1},
			{Key: "terminalId", Value: 1},
			{Key: "terminalName", Value: 1},
			{Key: "branchName", Value: "$branchDoc.companyName"},
			{Key: "branchCode", Value: "$branchDoc.branchCode"},
			{Key: "districtName", Value: "$districtDoc.districtName"},
			{Key: "site", Value: 1},
			{Key: "cbsAccount", Value: bson.D{
				{Key: "$convert", Value: bson.D{
					{Key: "input", Value: "$cbsAccount"},
					{Key: "to", Value: "string"},
					{Key: "onError", Value: ""},
					{Key: "onNull", Value: ""},
				}},
			}},
			{Key: "port", Value: 1},
			{Key: "ipAddress", Value: 1},
			{Key: "status", Value: 1},
			{Key: "isDeleted", Value: bson.D{
				{Key: "$eq", Value: bson.A{"$isDeleted", true}},
			}},
			{Key: "createdAt", Value: 1},
			{Key: "updatedAt", Value: 1},
		}}},
		bson.D{{Key: "$sort", Value: bson.D{{Key: "terminalId", Value: 1}}}},
	}

	cursor, err := r.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchAtmTerminals, err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	terminals := make([]model.AtmTerminal, 0)
	if err := cursor.All(ctx, &terminals); err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchAtmTerminals, err)
	}

	return terminals, nil
}
