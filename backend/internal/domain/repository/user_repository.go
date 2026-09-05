package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type UserRepository interface {
	FindByUsername(c context.Context, username string) (*model.User, error)
	FindByID(ctx context.Context, userID primitive.ObjectID) (*model.User, error)
	FindAll(ctx context.Context) ([]model.User, error)
	Create(ctx context.Context, user *model.User) error
	Update(ctx context.Context, user *model.User) error
	CountByPermission(ctx context.Context, permissionName string) (int64, error)
}
