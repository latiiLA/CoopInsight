package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PermissionRepository interface {
	Create(ctx context.Context, permission *model.Permission) error
	FindByID(ctx context.Context, permissionID primitive.ObjectID) (*model.Permission, error)
	FindByName(ctx context.Context, name string) (*model.Permission, error)
	FindAll(ctx context.Context) ([]model.Permission, error)
	Update(ctx context.Context, permission *model.Permission) error
	Delete(ctx context.Context, permission *model.Permission) error
}
