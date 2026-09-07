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
				{Key: "$ne", Value: model.StatusDeleted},
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
			{Key: "avatar", Value: 1},
			{Key: "profile", Value: 1},
			{Key: "password", Value: 1},
			{Key: "permissions", Value: 1},
			{Key: "roleId", Value: 1},
			{Key: "lastLogin", Value: 1},
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
		return nil, wrapDBError(common.ErrFailedToFetchUser, err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var user model.User
	if !cursor.Next(ctx) {
		if err := cursor.Err(); err != nil {
			return nil, wrapDBError(common.ErrFailedToFetchUser, err)
		}

		return nil, nil
	}

	if err := cursor.Decode(&user); err != nil {
		return nil, wrapDBError(common.ErrFailedToDecodeUser, err)
	}

	return &user, nil
}

func (ur *userRepository) FindByID(ctx context.Context, userID primitive.ObjectID) (*model.User, error) {
	pipeline := mongo.Pipeline{
		bson.D{{Key: "$match", Value: bson.D{
			{Key: "_id", Value: userID},
			{Key: "status", Value: bson.D{
				{Key: "$ne", Value: model.StatusDeleted},
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
		bson.D{{Key: "$lookup", Value: bson.D{
			{Key: "from", Value: "users"},
			{Key: "localField", Value: "createdBy"},
			{Key: "foreignField", Value: "_id"},
			{Key: "as", Value: "creator"},
		}}},
		bson.D{{Key: "$unwind", Value: bson.D{
			{Key: "path", Value: "$creator"},
			{Key: "preserveNullAndEmptyArrays", Value: true},
		}}},
		bson.D{{Key: "$lookup", Value: bson.D{
			{Key: "from", Value: "users"},
			{Key: "localField", Value: "updatedBy"},
			{Key: "foreignField", Value: "_id"},
			{Key: "as", Value: "updater"},
		}}},
		bson.D{{Key: "$unwind", Value: bson.D{
			{Key: "path", Value: "$updater"},
			{Key: "preserveNullAndEmptyArrays", Value: true},
		}}},
		bson.D{{Key: "$project", Value: bson.D{
			{Key: "_id", Value: 1},
			{Key: "firstName", Value: 1},
			{Key: "middleName", Value: 1},
			{Key: "lastName", Value: 1},
			{Key: "email", Value: 1},
			{Key: "role", Value: 1},
			{Key: "roleId", Value: 1},
			{Key: "username", Value: 1},
			{Key: "status", Value: 1},
			{Key: "avatar", Value: 1},
			{Key: "profile", Value: 1},
			{Key: "permissions", Value: 1},
			{Key: "lastLogin", Value: 1},
			{Key: "createdAt", Value: 1},
			{Key: "updatedAt", Value: 1},
			{Key: "createdBy", Value: 1},
			{Key: "updatedBy", Value: 1},
			{Key: "creator", Value: 1},
			{Key: "updater", Value: 1},
		}}},
	}

	cursor, err := ur.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchUser, err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	if !cursor.Next(ctx) {
		if err := cursor.Err(); err != nil {
			return nil, wrapDBError(common.ErrFailedToFetchUser, err)
		}

		return nil, nil
	}

	var user model.User
	if err := cursor.Decode(&user); err != nil {
		return nil, wrapDBError(common.ErrFailedToDecodeUser, err)
	}

	return &user, nil
}

func (ur *userRepository) FindAll(ctx context.Context) ([]model.User, error) {

	pipeline := mongo.Pipeline{
		bson.D{
			{Key: "$match", Value: bson.D{
				{Key: "status", Value: bson.D{
					{Key: "$ne", Value: model.StatusDeleted},
				}},
				{Key: "$or", Value: bson.A{
					bson.D{{Key: "roleId", Value: bson.D{
						{Key: "$exists", Value: true},
						{Key: "$nin", Value: bson.A{nil, primitive.NilObjectID}},
					}}},
					bson.D{{Key: "status", Value: bson.D{
						{Key: "$ne", Value: model.StatusNew},
					}}},
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
				{Key: "avatar", Value: 1},
				{Key: "profile", Value: 1},
				{Key: "lastLogin", Value: 1},
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
		return nil, wrapDBError(common.ErrFailedToFetchUsers, err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var users []model.User
	if err := cursor.All(ctx, &users); err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchUsers, err)
	}

	// prettyJSON, _ := json.MarshalIndent(users, "", "  ")
	// fmt.Println("users:", string(prettyJSON))

	return users, nil
}

func (ur *userRepository) FindUnassignedNew(ctx context.Context) ([]model.User, error) {
	cursor, err := ur.collection.Find(ctx, bson.M{
		"status": model.StatusNew,
		"$or": []bson.M{
			{"roleId": bson.M{"$exists": false}},
			{"roleId": nil},
			{"roleId": primitive.NilObjectID},
		},
	}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}))
	if err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchUsers, err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	users := make([]model.User, 0)
	if err := cursor.All(ctx, &users); err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchUsers, err)
	}

	return users, nil
}

func (ur *userRepository) Create(ctx context.Context, user *model.User) error {
	if user.ID.IsZero() {
		user.ID = primitive.NewObjectID()
	}

	_, err := ur.collection.InsertOne(ctx, user)
	if err != nil {
		return wrapDBError(common.ErrFailedToCreateUser, err)
	}

	return nil
}

func (ur *userRepository) Update(ctx context.Context, user *model.User) error {
	result, err := ur.collection.UpdateOne(
		ctx,
		bson.M{
			"_id": user.ID,
			"status": bson.M{
				"$ne": model.StatusDeleted,
			},
		},
		bson.M{
			"$set": bson.M{
				"firstName":   user.FirstName,
				"middleName":  user.MiddleName,
				"lastName":    user.LastName,
				"email":       user.Email,
				"roleId":      user.RoleID,
				"permissions": user.Permissions,
				"status":      user.Status,
				"updatedAt":   user.UpdatedAt,
				"updatedBy":   user.UpdatedBy,
			},
		},
	)
	if err != nil {
		return wrapDBError(common.ErrFailedToUpdateUser, err)
	}

	if result.MatchedCount == 0 {
		return common.ErrUserNotFound
	}

	return nil
}

func (ur *userRepository) UpdateAvatar(ctx context.Context, userID primitive.ObjectID, avatar string, updatedAt time.Time) error {
	result, err := ur.collection.UpdateOne(
		ctx,
		bson.M{
			"_id": userID,
			"status": bson.M{
				"$ne": model.StatusDeleted,
			},
		},
		bson.M{
			"$set": bson.M{
				"avatar":    avatar,
				"updatedAt": updatedAt,
			},
		},
	)
	if err != nil {
		return wrapDBError(common.ErrFailedToUpdateUser, err)
	}

	if result.MatchedCount == 0 {
		return common.ErrUserNotFound
	}

	return nil
}

func (ur *userRepository) UpdateProfile(ctx context.Context, userID primitive.ObjectID, profile model.UserProfile, updatedAt time.Time) error {
	result, err := ur.collection.UpdateOne(
		ctx,
		bson.M{
			"_id": userID,
			"status": bson.M{
				"$ne": model.StatusDeleted,
			},
		},
		bson.M{
			"$set": bson.M{
				"profile": bson.M{
					"jobTitle":   profile.JobTitle,
					"department": profile.Department,
					"branch":     profile.Branch,
					"phone":      profile.Phone,
					"bio":        profile.Bio,
				},
				"updatedAt": updatedAt,
			},
		},
	)
	if err != nil {
		return wrapDBError(common.ErrFailedToUpdateUser, err)
	}

	if result.MatchedCount == 0 {
		return common.ErrUserNotFound
	}

	return nil
}

func (ur *userRepository) CountByPermission(ctx context.Context, permissionName string) (int64, error) {
	count, err := ur.collection.CountDocuments(ctx, bson.M{
		"permissions": permissionName,
		"status": bson.M{
			"$ne": model.StatusDeleted,
		},
	})
	if err != nil {
		return 0, wrapDBError(common.ErrFailedToFetchUsers, err)
	}

	return count, nil
}

func (ur *userRepository) CountByRole(ctx context.Context, roleID primitive.ObjectID) (int64, error) {
	count, err := ur.collection.CountDocuments(ctx, bson.M{
		"roleId": roleID,
		"status": bson.M{
			"$ne": model.StatusDeleted,
		},
	})
	if err != nil {
		return 0, wrapDBError(common.ErrFailedToFetchUsers, err)
	}

	return count, nil
}

func (ur *userRepository) UpdateLastLogin(ctx context.Context, userID primitive.ObjectID, lastLogin time.Time) error {
	result, err := ur.collection.UpdateOne(
		ctx,
		bson.M{
			"_id": userID,
			"status": bson.M{
				"$ne": model.StatusDeleted,
			},
		},
		bson.M{
			"$set": bson.M{
				"lastLogin": lastLogin,
			},
		},
	)
	if err != nil {
		return wrapDBError(common.ErrFailedToUpdateUser, err)
	}

	if result.MatchedCount == 0 {
		return common.ErrUserNotFound
	}

	return nil
}

func (ur *userRepository) HasActivity(ctx context.Context, userID primitive.ObjectID) (bool, error) {
	var stored struct {
		LastLogin *time.Time          `bson:"lastLogin"`
		UpdatedBy *primitive.ObjectID `bson:"updatedBy"`
	}

	err := ur.collection.FindOne(ctx, bson.M{
		"_id": userID,
		"status": bson.M{
			"$ne": model.StatusDeleted,
		},
	}).Decode(&stored)
	if isNoDocuments(err) {
		return false, common.ErrUserNotFound
	}
	if err != nil {
		return false, wrapDBError(common.ErrFailedToFetchUser, err)
	}

	if stored.LastLogin != nil && !stored.LastLogin.IsZero() {
		return true, nil
	}

	if stored.UpdatedBy != nil && *stored.UpdatedBy == userID {
		return true, nil
	}

	actorFilter := bson.M{
		"$or": []bson.M{
			{"createdBy": userID},
			{"updatedBy": userID},
			{"deletedBy": userID},
		},
	}

	db := ur.collection.Database()
	for _, name := range []string{"roles", "permissions"} {
		count, countErr := db.Collection(name).CountDocuments(ctx, actorFilter)
		if countErr != nil {
			return false, wrapDBError(common.ErrFailedToFetchUsers, countErr)
		}
		if count > 0 {
			return true, nil
		}
	}

	otherUsers, err := ur.collection.CountDocuments(ctx, bson.M{
		"_id": bson.M{"$ne": userID},
		"$or": []bson.M{
			{"createdBy": userID},
			{"updatedBy": userID},
			{"deletedBy": userID},
		},
	})
	if err != nil {
		return false, wrapDBError(common.ErrFailedToFetchUsers, err)
	}
	if otherUsers > 0 {
		return true, nil
	}

	requests, err := db.Collection("account_requests").CountDocuments(ctx, bson.M{
		"fulfilledBy": userID,
	})
	if err != nil {
		return false, wrapDBError(common.ErrFailedToFetchAccountRequests, err)
	}

	return requests > 0, nil
}

func (ur *userRepository) Delete(ctx context.Context, user *model.User) error {
	result, err := ur.collection.UpdateOne(
		ctx,
		bson.M{
			"_id": user.ID,
			"status": bson.M{
				"$ne": model.StatusDeleted,
			},
		},
		bson.M{
			"$set": bson.M{
				"status":    model.StatusDeleted,
				"deletedAt": user.DeletedAt,
				"deletedBy": user.DeletedBy,
				"updatedAt": user.UpdatedAt,
			},
		},
	)
	if err != nil {
		return wrapDBError(common.ErrFailedToDeleteUser, err)
	}

	if result.MatchedCount == 0 {
		return common.ErrUserNotFound
	}

	return nil
}
