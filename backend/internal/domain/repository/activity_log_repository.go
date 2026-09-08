package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type ActivityLogRepository interface {
	Create(ctx context.Context, entry *model.ActivityLog) error
	List(ctx context.Context, filter model.ActivityLogFilter) ([]model.ActivityLog, int64, error)
}
