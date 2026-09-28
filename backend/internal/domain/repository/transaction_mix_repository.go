package repository

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type TransactionMixRepository interface {
	// GetMix aggregates the switch log over a date range in a single scan and
	// pivots the result into the scheme, routing and message type breakdowns.
	// One scan matters here: these are millions of rows and three separate
	// GROUP BY queries take roughly three times as long.
	GetMix(
		ctx context.Context,
		dateFrom, dateTo, channel string,
	) (*model.TransactionMixReport, error)
}
