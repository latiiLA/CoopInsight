package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type RoleRepository interface {
	FindByID(ctx context.Context, roleID primitive.ObjectID) (*model.Role, error)
	FindByName(ctx context.Context, name string) (*model.Role, error)
	FindAll(ctx context.Context) ([]model.Role, error)
	Create(ctx context.Context, role *model.Role) error
	Update(ctx context.Context, role *model.Role) error
	Delete(ctx context.Context, role *model.Role) error
	CountByPermission(ctx context.Context, permissionName string) (int64, error)
}
