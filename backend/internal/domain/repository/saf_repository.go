package repository

import (
	"context"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type SafRepository interface {
	Summary(ctx context.Context, from, to time.Time) (*model.SafSummary, error)
	ListByRange(ctx context.Context, from, to time.Time, status string, limit int) ([]model.SafTransaction, error)
}
