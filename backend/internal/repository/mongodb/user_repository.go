package mongodb

import (
	"context"
	"errors"
	"fmt"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type userRepository struct {
	db         *mongo.Database
	collection *mongo.Collection
}

func NewUserRepository(db *mongo.Database) repository.UserRepository {
	return &userRepository{
		db:         db,
		collection: db.Collection("users"),
	}
}

func (ur *userRepository) FindByUsername(ctx context.Context, username string) (*model.User, error) {
	pipeline := mongo.Pipeline{
		bson.D{{Key: "$match", Value: bson.D{
			{Key: "username", Value: username},
			{Key: "status", Value: bson.D{
				{Key: "$ne", Value: "Deleted"},
			}},
		}}},
		bson.D{{Key: "$lookup", Value: bson.D{
			{Key: "from", Value: "roles"},
			{Key: "localField", Value: "roleId"},
			{Key: "foreignField", Value: "_id"},
			{Key: "as", Value: "role"},
		}}},
		bson.D{{Key: "$unwind", Value: bson.D{
			{Key: "path", Value: "$role"},
			{Key: "preserveNullAndEmptyArrays", Value: true},
		}}},

		// User - Creator
		bson.D{
			{Key: "$lookup", Value: bson.D{
				{Key: "from", Value: "users"},
				{Key: "localField", Value: "createdBy"},
				{Key: "foreignField", Value: "_id"},
				{Key: "as", Value: "creator"},
			}},
		},
		bson.D{
			{Key: "$unwind", Value: bson.D{
				{Key: "path", Value: "$creator"},
				{Key: "preserveNullAndEmptyArrays", Value: true},
			}},
		},

		// User - Updater
		bson.D{
			{Key: "$lookup", Value: bson.D{
				{Key: "from", Value: "users"},
				{Key: "localField", Value: "createdBy"},
				{Key: "foreignField", Value: "_id"},
				{Key: "as", Value: "updater"},
			}},
		},
		bson.D{
			{Key: "$unwind", Value: bson.D{
				{Key: "path", Value: "$updater"},
				{Key: "preserveNullAndEmptyArrays", Value: true},
			}},
		},

		bson.D{{Key: "$project", Value: bson.D{
			{Key: "_id", Value: 1},
			{Key: "role", Value: 1},
			{Key: "username", Value: 1},
			{Key: "status", Value: 1},
			{Key: "password", Value: 1},
			{Key: "permissions", Value: 1},
			{Key: "roleId", Value: 1},
			{Key: "createdAt", Value: 1},
			{Key: "updatedAt", Value: 1},
			{Key: "createdBy", Value: 1},
			{Key: "creator", Value: 1},
			{Key: "updater", Value: 1},
			{Key: "updatedBy", Value: 1},
			{Key: "deletedAt", Value: 1},
			{Key: "deletedBy", Value: 1},
		}}},
	}

	cursor, err := ur.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("aggregation error: %w", err)
	}
	defer cursor.Close(ctx)

	var user model.User
	if !cursor.Next(ctx) {
		return nil, mongo.ErrNoDocuments
	}

	if err := cursor.Decode(&user); err != nil {
		return nil, fmt.Errorf("decode error: %w", err)
	}

	return &user, nil
}

func (r *userRepository) GetByID(ctx context.Context, id string) (*model.User, error) {

	var u model.User

	err := r.collection.FindOne(
		ctx,
		bson.M{"_id": id},
	).Decode(&u)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("not found")
		}

		return nil, err
	}

	return &u, nil
}
