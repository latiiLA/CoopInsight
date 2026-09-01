package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type UserRepository interface {
	FindByUsername(c context.Context, username string) (*model.User, error)
	GetByID(ctx context.Context, id string) (*model.User, error)
}
