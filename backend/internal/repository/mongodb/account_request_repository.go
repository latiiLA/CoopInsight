package mongodb

import (
	"context"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type accountRequestRepository struct {
	collection *mongo.Collection
}

func NewAccountRequestRepository(db *mongo.Database) repository.AccountRequestRepository {
	return &accountRequestRepository{
		collection: db.Collection("account_requests"),
	}
}

func (r *accountRequestRepository) Create(ctx context.Context, request *model.AccountRequest) error {
	if request.ID.IsZero() {
		request.ID = primitive.NewObjectID()
	}

	_, err := r.collection.InsertOne(ctx, request)
	if err != nil {
		return wrapDBError(common.ErrFailedToCreateAccountRequest, err)
	}

	return nil
}

func (r *accountRequestRepository) FindByID(ctx context.Context, id primitive.ObjectID) (*model.AccountRequest, error) {
	var request model.AccountRequest

	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&request)
	if isNoDocuments(err) {
		return nil, nil
	}
	if err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchAccountRequests, err)
	}

	return &request, nil
}

func (r *accountRequestRepository) FindPendingByUsername(ctx context.Context, username string) (*model.AccountRequest, error) {
	var request model.AccountRequest

	err := r.collection.FindOne(ctx, bson.M{
		"username": username,
		"status":   model.AccountRequestPending,
	}).Decode(&request)
	if isNoDocuments(err) {
		return nil, nil
	}
	if err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchAccountRequests, err)
	}

	return &request, nil
}

func (r *accountRequestRepository) FindPending(ctx context.Context) ([]model.AccountRequest, error) {
	cursor, err := r.collection.Find(ctx, bson.M{
		"status": model.AccountRequestPending,
	}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}))
	if err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchAccountRequests, err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	requests := make([]model.AccountRequest, 0)
	if err := cursor.All(ctx, &requests); err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchAccountRequests, err)
	}

	return requests, nil
}

func (r *accountRequestRepository) Fulfill(ctx context.Context, id, fulfilledBy, userID primitive.ObjectID, updatedAt time.Time) error {
	result, err := r.collection.UpdateOne(
		ctx,
		bson.M{
			"_id":    id,
			"status": model.AccountRequestPending,
		},
		bson.M{
			"$set": bson.M{
				"status":          model.AccountRequestFulfilled,
				"fulfilledBy":     fulfilledBy,
				"fulfilledUserId": userID,
				"updatedAt":       updatedAt,
			},
		},
	)
	if err != nil {
		return wrapDBError(common.ErrFailedToUpdateAccountRequest, err)
	}
	if result.MatchedCount == 0 {
		return common.ErrAccountRequestNotFound
	}

	return nil
}
