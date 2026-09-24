package repository

import (
	"context"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type CardRepository interface {
	CountCardPerStatus(ctx context.Context, dateFrom *time.Time, dateTo *time.Time) ([]model.Card, error)
	CardActivity(ctx context.Context, dateFrom time.Time, dateTo time.Time) ([]model.CardDailyActivity, error)
	CardActivityByBranch(ctx context.Context, dateFrom time.Time, dateTo time.Time) ([]model.CardBranchActivity, error)
	CardActivityForBranch(ctx context.Context, branchID int64, dateFrom time.Time, dateTo time.Time) ([]model.CardDailyActivity, error)
}
