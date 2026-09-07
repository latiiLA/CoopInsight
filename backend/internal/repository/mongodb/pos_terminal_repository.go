package mongodb

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type posTerminalRepository struct {
	collection *mongo.Collection
}

func NewPosTerminalRepository(db *mongo.Database) repository.PosTerminalRepository {
	return &posTerminalRepository{
		collection: db.Collection("pos"),
	}
}

func toString(field string) bson.D {
	return bson.D{
		{Key: "$convert", Value: bson.D{
			{Key: "input", Value: field},
			{Key: "to", Value: "string"},
			{Key: "onError", Value: ""},
			{Key: "onNull", Value: ""},
		}},
	}
}

func (r *posTerminalRepository) FindAll(ctx context.Context) ([]model.PosTerminal, error) {
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
			{Key: "terminalId", Value: 1},
			{Key: "merchantId", Value: 1},
			{Key: "merchantName", Value: 1},
			{Key: "merchantAddress", Value: 1},
			{Key: "businessType", Value: 1},
			{Key: "branchName", Value: "$branchDoc.companyName"},
			{Key: "branchCode", Value: "$branchDoc.branchCode"},
			{Key: "districtName", Value: "$districtDoc.districtName"},
			{Key: "site", Value: 1},
			{Key: "cbsAccount", Value: toString("$posCbsAccount")},
			{Key: "ipAddress", Value: "$staticIp"},
			{Key: "serviceNumber", Value: toString("$serviceNumber")},
			{Key: "contactName", Value: 1},
			{Key: "contactPhone", Value: toString("$contactPhonenumber")},
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
		return nil, wrapDBError(common.ErrFailedToFetchPosTerminals, err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	terminals := make([]model.PosTerminal, 0)
	if err := cursor.All(ctx, &terminals); err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchPosTerminals, err)
	}

	return terminals, nil
}
