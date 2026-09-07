package mongodb

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type permissionRepository struct {
	db         *mongo.Database
	collection *mongo.Collection
}

func NewPermissionRepository(db *mongo.Database) repository.PermissionRepository {
	return &permissionRepository{
		db:         db,
		collection: db.Collection("permissions"),
	}
}

func (r *permissionRepository) Create(ctx context.Context, permission *model.Permission) error {
	if permission.ID.IsZero() {
		permission.ID = primitive.NewObjectID()
	}

	_, err := r.collection.InsertOne(ctx, permission)
	if err != nil {
		return wrapDBError(common.ErrFailedToCreatePermission, err)
	}

	return nil
}

func (r *permissionRepository) FindByID(ctx context.Context, permissionID primitive.ObjectID) (*model.Permission, error) {
	var permission model.Permission

	err := r.collection.FindOne(ctx, bson.M{
		"_id": permissionID,
		"status": bson.M{
			"$ne": model.PermissionStatusDeleted,
		},
	}).Decode(&permission)

	if isNoDocuments(err) {
		return nil, nil
	}
	if err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchPermission, err)
	}

	return &permission, nil
}

func (r *permissionRepository) FindByName(ctx context.Context, name string) (*model.Permission, error) {
	var permission model.Permission

	err := r.collection.FindOne(ctx, bson.M{
		"name": name,
		"status": bson.M{
			"$ne": model.PermissionStatusDeleted,
		},
	}).Decode(&permission)

	if isNoDocuments(err) {
		return nil, nil
	}
	if err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchPermission, err)
	}

	return &permission, nil
}

func (r *permissionRepository) FindAll(ctx context.Context) ([]model.Permission, error) {
	pipeline := mongo.Pipeline{
		bson.D{{Key: "$match", Value: bson.D{
			{Key: "status", Value: bson.D{
				{Key: "$ne", Value: model.PermissionStatusDeleted},
			}},
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
		bson.D{{Key: "$sort", Value: bson.D{
			{Key: "name", Value: 1},
		}}},
		bson.D{{Key: "$project", Value: bson.D{
			{Key: "_id", Value: 1},
			{Key: "name", Value: 1},
			{Key: "resource", Value: 1},
			{Key: "action", Value: 1},
			{Key: "description", Value: 1},
			{Key: "status", Value: 1},
			{Key: "createdAt", Value: 1},
			{Key: "updatedAt", Value: 1},
			{Key: "createdBy", Value: 1},
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
		}}},
	}

	cursor, err := r.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchPermissions, err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var permissions []model.Permission
	if err := cursor.All(ctx, &permissions); err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchPermissions, err)
	}

	if permissions == nil {
		permissions = []model.Permission{}
	}

	return permissions, nil
}

func (r *permissionRepository) Update(ctx context.Context, permission *model.Permission) error {
	result, err := r.collection.UpdateOne(
		ctx,
		bson.M{
			"_id": permission.ID,
			"status": bson.M{
				"$ne": model.PermissionStatusDeleted,
			},
		},
		bson.M{
			"$set": bson.M{
				"name":        permission.Name,
				"resource":    permission.Resource,
				"action":      permission.Action,
				"description": permission.Description,
				"updatedAt":   permission.UpdatedAt,
				"updatedBy":   permission.UpdatedBy,
			},
		},
	)
	if err != nil {
		return wrapDBError(common.ErrFailedToUpdatePermission, err)
	}

	if result.MatchedCount == 0 {
		return common.ErrPermissionNotFound
	}

	return nil
}

func (r *permissionRepository) Delete(ctx context.Context, permission *model.Permission) error {
	result, err := r.collection.UpdateOne(
		ctx,
		bson.M{
			"_id": permission.ID,
			"status": bson.M{
				"$ne": model.PermissionStatusDeleted,
			},
		},
		bson.M{
			"$set": bson.M{
				"status":    model.PermissionStatusDeleted,
				"deletedAt": permission.DeletedAt,
				"deletedBy": permission.DeletedBy,
				"updatedAt": permission.UpdatedAt,
			},
		},
	)
	if err != nil {
		return wrapDBError(common.ErrFailedToDeletePermission, err)
	}

	if result.MatchedCount == 0 {
		return common.ErrPermissionNotFound
	}

	return nil
}
