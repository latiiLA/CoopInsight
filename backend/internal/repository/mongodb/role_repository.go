package mongodb

import (
	"context"
	"regexp"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type roleRepository struct {
	collection *mongo.Collection
}

func NewRoleRepository(db *mongo.Database) repository.RoleRepository {
	return &roleRepository{
		collection: db.Collection("roles"),
	}
}

func (r *roleRepository) FindByID(ctx context.Context, roleID primitive.ObjectID) (*model.Role, error) {
	var role model.Role

	err := r.collection.FindOne(ctx, bson.M{
		"_id": roleID,
		"status": bson.M{
			"$ne": model.RoleStatusDeleted,
		},
	}).Decode(&role)

	if isNoDocuments(err) {
		return nil, nil
	}
	if err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchRole, err)
	}

	return &role, nil
}

func (r *roleRepository) FindByName(ctx context.Context, name string) (*model.Role, error) {
	var role model.Role

	err := r.collection.FindOne(ctx, bson.M{
		"name": primitive.Regex{Pattern: "^" + regexp.QuoteMeta(name) + "$", Options: "i"},
		"status": bson.M{
			"$ne": model.RoleStatusDeleted,
		},
	}).Decode(&role)

	if isNoDocuments(err) {
		return nil, nil
	}
	if err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchRole, err)
	}

	return &role, nil
}

func (r *roleRepository) FindAll(ctx context.Context) ([]model.Role, error) {
	cursor, err := r.collection.Find(ctx, bson.M{
		"status": bson.M{
			"$ne": model.RoleStatusDeleted,
		},
	}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}))
	if err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchRoles, err)
	}
	defer cursor.Close(ctx)

	var roles []model.Role
	if err := cursor.All(ctx, &roles); err != nil {
		return nil, wrapDBError(common.ErrFailedToFetchRoles, err)
	}

	if roles == nil {
		roles = []model.Role{}
	}

	return roles, nil
}

func (r *roleRepository) Create(ctx context.Context, role *model.Role) error {
	if role.ID.IsZero() {
		role.ID = primitive.NewObjectID()
	}

	_, err := r.collection.InsertOne(ctx, role)
	if err != nil {
		return wrapDBError(common.ErrFailedToCreateRole, err)
	}

	return nil
}

func (r *roleRepository) Update(ctx context.Context, role *model.Role) error {
	result, err := r.collection.UpdateOne(
		ctx,
		bson.M{
			"_id": role.ID,
			"status": bson.M{
				"$ne": model.RoleStatusDeleted,
			},
		},
		bson.M{
			"$set": bson.M{
				"name":        role.Name,
				"permissions": role.Permissions,
				"updatedAt":   role.UpdatedAt,
				"updatedBy":   role.UpdatedBy,
			},
		},
	)
	if err != nil {
		return wrapDBError(common.ErrFailedToUpdateRole, err)
	}

	if result.MatchedCount == 0 {
		return common.ErrRoleNotFound
	}

	return nil
}

func (r *roleRepository) CountByPermission(ctx context.Context, permissionName string) (int64, error) {
	count, err := r.collection.CountDocuments(ctx, bson.M{
		"permissions": permissionName,
		"status": bson.M{
			"$ne": model.RoleStatusDeleted,
		},
	})
	if err != nil {
		return 0, wrapDBError(common.ErrFailedToFetchRoles, err)
	}

	return count, nil
}
