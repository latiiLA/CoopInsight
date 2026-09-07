package repository

import (
	"context"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type AccountRequestRepository interface {
	Create(ctx context.Context, request *model.AccountRequest) error
	FindByID(ctx context.Context, id primitive.ObjectID) (*model.AccountRequest, error)
	FindPendingByUsername(ctx context.Context, username string) (*model.AccountRequest, error)
	FindPending(ctx context.Context) ([]model.AccountRequest, error)
	Fulfill(ctx context.Context, id, fulfilledBy, userID primitive.ObjectID, updatedAt time.Time) error
}
