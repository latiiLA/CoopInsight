package service

import (
	"context"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

// maxMixRangeDays caps the mix query. The aggregate reads every row in the
// range with no index to lean on, and 90 days measured at about 50 seconds,
// so anything longer is rejected rather than left to run into the driver
// timeout.
const maxMixRangeDays = 90

type TransactionMixService interface {
	GetMix(
		ctx context.Context,
		dateFrom, dateTo, channel string,
	) (*model.TransactionMixReport, error)
}

type transactionMixService struct {
	repository repository.TransactionMixRepository
}

func NewTransactionMixService(
	repository repository.TransactionMixRepository,
) TransactionMixService {
	return &transactionMixService{repository: repository}
}

func (s *transactionMixService) GetMix(
	ctx context.Context,
	dateFrom, dateTo, channel string,
) (*model.TransactionMixReport, error) {
	if s.repository == nil {
		return nil, common.ErrOracleUnavailable
	}

	from, err := parseReportDate(dateFrom)
	if err != nil {
		return nil, err
	}

	to, err := parseReportDate(dateTo)
	if err != nil {
		return nil, err
	}

	fromTime, _ := time.Parse("01-02-2006", from)
	toTime, _ := time.Parse("01-02-2006", to)

	if fromTime.After(toTime) {
		return nil, common.ErrInvalidDateRange
	}

	// The cap is inclusive, so an n-day range spans n-1 days. Comparing against
	// maxMixRangeDays directly would quietly admit a 91 day range.
	if toTime.Sub(fromTime) > (maxMixRangeDays-1)*24*time.Hour {
		return nil, common.ErrMixRangeTooLarge
	}

	resolvedChannel, err := normaliseMixChannel(channel)
	if err != nil {
		return nil, err
	}

	report, err := s.repository.GetMix(ctx, from, to, resolvedChannel)
	if err != nil {
		return nil, err
	}

	if report == nil {
		return &model.TransactionMixReport{
			DateFrom:  from,
			DateTo:    to,
			Channel:   resolvedChannel,
			ByScheme:  []model.TransactionMixSegment{},
			ByRouting: []model.TransactionMixSegment{},
			ByType:    []model.TransactionMixSlice{},
		}, nil
	}

	// Empty slices rather than nulls, so the frontend can render straight from
	// the response without null checks on every axis.
	if report.ByScheme == nil {
		report.ByScheme = []model.TransactionMixSegment{}
	}
	if report.ByRouting == nil {
		report.ByRouting = []model.TransactionMixSegment{}
	}
	if report.ByType == nil {
		report.ByType = []model.TransactionMixSlice{}
	}

	return report, nil
}

func normaliseMixChannel(channel string) (string, error) {
	switch channel {
	case "":
		return "switch", nil
	case "switch", "atm", "pos":
		return channel, nil
	default:
		return "", common.ErrInvalidSuccessChannel
	}
}
