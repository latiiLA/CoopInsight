package repository

import (
	"context"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

// CardStatusFilter selects and shapes the cards-per-status report.
//
// GroupBy and DateField are validated against whitelists before they reach SQL.
// DateField decides which date the range filter and the ageing buckets use.
type CardStatusFilter struct {
	// GroupBy: status | product | branch | status-product | status-branch
	GroupBy string
	// DateField: created (DATE_CREATED) | statusChanged (DATE_STATCHG)
	DateField string
	DateFrom  *time.Time
	DateTo    *time.Time
	ProductID *int64
	BranchID  *int64
	// ExpiringWithinMonths is the expiry window. Zero disables the measure.
	//
	// This portfolio's cards all expire in 2029 or later, so a short window
	// returns zero for every group; the handler defaults to 60 months.
	ExpiringWithinMonths int
}

type CardRepository interface {
	CountCardPerStatus(ctx context.Context, filter CardStatusFilter) ([]model.Card, error)
	CardActivity(ctx context.Context, dateFrom time.Time, dateTo time.Time) ([]model.CardDailyActivity, error)
	CardActivityByBranch(ctx context.Context, dateFrom time.Time, dateTo time.Time) ([]model.CardBranchActivity, error)
	CardActivityForBranch(ctx context.Context, branchID int64, dateFrom time.Time, dateTo time.Time) ([]model.CardDailyActivity, error)
	// ListCardDetails returns one page of individual cards whose activity date
	// for the given metric falls in [dateFrom, dateTo], optionally narrowed to a
	// branch. The second return value reports whether more rows exist past this
	// page. includeCardholder controls whether the name column is selected.
	ListCardDetails(
		ctx context.Context,
		metric string,
		dateFrom time.Time,
		dateTo time.Time,
		branchID *int64,
		page int,
		pageSize int,
		includeCardholder bool,
	) ([]model.CardDetail, bool, error)
}
