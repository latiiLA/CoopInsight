package mongodb

import (
	"context"
	"errors"
	"fmt"
	"regexp"

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
			"$ne": "deleted",
		},
	}).Decode(&role)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, mongo.ErrNoDocuments
		}

		return nil, err
	}

	return &role, nil
}

func (r *roleRepository) FindByName(ctx context.Context, name string) (*model.Role, error) {
	var role model.Role

	err := r.collection.FindOne(ctx, bson.M{
		"name": primitive.Regex{Pattern: "^" + regexp.QuoteMeta(name) + "$", Options: "i"},
		"status": bson.M{
			"$ne": "deleted",
		},
	}).Decode(&role)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, mongo.ErrNoDocuments
		}

		return nil, err
	}

	return &role, nil
}

func (r *roleRepository) FindAll(ctx context.Context) ([]model.Role, error) {
	cursor, err := r.collection.Find(ctx, bson.M{
		"status": bson.M{
			"$ne": "deleted",
		},
	}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var roles []model.Role
	if err := cursor.All(ctx, &roles); err != nil {
		return nil, err
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
		return fmt.Errorf("failed to create role: %w", err)
	}

	return nil
}
