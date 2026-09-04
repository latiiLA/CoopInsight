package mongodb

import (
	"context"
	"errors"
	"fmt"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
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
				{Key: "$ne", Value: "deleted"},
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
				{Key: "localField", Value: "updatedBy"},
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
			{Key: "firstName", Value: 1},
			{Key: "middleName", Value: 1},
			{Key: "lastName", Value: 1},
			{Key: "email", Value: 1},
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

func (r *userRepository) FindByID(ctx context.Context, id string) (*model.User, error) {

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

func (ur *userRepository) FindAll(ctx context.Context) ([]model.User, error) {

	pipeline := mongo.Pipeline{
		bson.D{
			{Key: "$match", Value: bson.D{
				{Key: "status", Value: bson.D{
					{Key: "$ne", Value: "deleted"},
				}},
			}},
		},

		// Role
		bson.D{
			{Key: "$lookup", Value: bson.D{
				{Key: "from", Value: "roles"},
				{Key: "localField", Value: "roleId"},
				{Key: "foreignField", Value: "_id"},
				{Key: "as", Value: "role"},
			}},
		},
		bson.D{
			{Key: "$unwind", Value: bson.D{
				{Key: "path", Value: "$role"},
				{Key: "preserveNullAndEmptyArrays", Value: true},
			}},
		},

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
				{Key: "localField", Value: "updatedBy"},
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

		// sort
		bson.D{{Key: "$sort", Value: bson.D{
			{Key: "createdAt", Value: -1},
		}}},

		bson.D{
			{Key: "$project", Value: bson.D{
				{Key: "_id", Value: 1},
				{Key: "firstName", Value: 1},
				{Key: "middleName", Value: 1},
				{Key: "lastName", Value: 1},
				{Key: "roleId", Value: 1},
				{Key: "role", Value: 1},
				{Key: "permissions", Value: 1},
				{Key: "email", Value: 1},
				{Key: "username", Value: 1},
				{Key: "status", Value: 1},
				{Key: "createdAt", Value: 1},
				{Key: "updatedAt", Value: 1},
				{Key: "createdAy", Value: 1},
				{Key: "updatedBy", Value: 1},
				{Key: "deletedBy", Value: 1},
				{Key: "deletedAt", Value: 1},

				{Key: "creator", Value: bson.D{{Key: "$cond", Value: bson.A{
					bson.D{{Key: "$ifNull", Value: bson.A{"$creator._id", false}}},
					"$creator",
					"$$REMOVE",
				}}}},
				{Key: "updater", Value: bson.D{{Key: "$cond", Value: bson.A{
					bson.D{{Key: "$ifNull", Value: bson.A{"$updater._id", false}}},
					"$updater",
					"$$REMOVE",
				}}}},
			}},
		},
	}

	cursor, err := ur.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var users []model.User
	if err := cursor.All(ctx, &users); err != nil {
		return nil, err
	}

	// prettyJSON, _ := json.MarshalIndent(users, "", "  ")
	// fmt.Println("users:", string(prettyJSON))

	return users, nil
}

func (ur *userRepository) Create(ctx context.Context, user *model.User) error {
	if user.ID.IsZero() {
		user.ID = primitive.NewObjectID()
	}

	_, err := ur.collection.InsertOne(ctx, user)
	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}
