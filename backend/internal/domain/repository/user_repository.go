package repository

import (
	"context"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type UserRepository interface {
	FindByUsername(c context.Context, username string) (*model.User, error)
	FindByID(ctx context.Context, userID primitive.ObjectID) (*model.User, error)
	FindAll(ctx context.Context) ([]model.User, error)
	FindUnassignedNew(ctx context.Context) ([]model.User, error)
	Create(ctx context.Context, user *model.User) error
	Update(ctx context.Context, user *model.User) error
	UpdateAvatar(ctx context.Context, userID primitive.ObjectID, avatar string, updatedAt time.Time) error
	UpdateProfile(ctx context.Context, userID primitive.ObjectID, profile model.UserProfile, updatedAt time.Time) error
	CountByPermission(ctx context.Context, permissionName string) (int64, error)
}
