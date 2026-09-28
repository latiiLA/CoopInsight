package service

import (
	"context"
	"testing"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type stubMixRepository struct {
	called    bool
	dateFrom  string
	dateTo    string
	channel   string
	returnErr error
	report    *model.TransactionMixReport
}

func (s *stubMixRepository) GetMix(
	_ context.Context,
	dateFrom, dateTo, channel string,
) (*model.TransactionMixReport, error) {
	s.called = true
	s.dateFrom = dateFrom
	s.dateTo = dateTo
	s.channel = channel
	return s.report, s.returnErr
}

func TestGetMixRejectsMalformedDates(t *testing.T) {
	repository := &stubMixRepository{}
	service := NewTransactionMixService(repository)

	for _, tc := range []struct{ name, from, to string }{
		{"bad from", "2026-09-20", "09-26-2026"},
		{"bad to", "09-20-2026", "not-a-date"},
		{"empty from", "", "09-26-2026"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := service.GetMix(
				context.Background(), tc.from, tc.to, "",
			); err == nil {
				t.Error("expected a date error, got nil")
			}
		})
	}

	if repository.called {
		t.Error("repository was called despite an invalid date")
	}
}

func TestGetMixRejectsReversedRange(t *testing.T) {
	service := NewTransactionMixService(&stubMixRepository{})

	_, err := service.GetMix(context.Background(), "09-26-2026", "09-20-2026", "")
	if err != common.ErrInvalidDateRange {
		t.Errorf("err = %v, want ErrInvalidDateRange", err)
	}
}

// The mix query scans every row in range, so the cap is what keeps a careless
// year-wide request from sitting in the driver until it times out.
func TestGetMixRejectsRangeBeyondTheCap(t *testing.T) {
	repository := &stubMixRepository{}
	service := NewTransactionMixService(repository)

	// 91 days inclusive is one past the cap. 90 days is still accepted below.
	if _, err := service.GetMix(
		context.Background(), "06-28-2026", "09-26-2026", "",
	); err != common.ErrMixRangeTooLarge {
		t.Errorf("err = %v, want ErrMixRangeTooLarge for a 91 day range", err)
	}

	if repository.called {
		t.Error("repository was called despite an oversized range")
	}

	// The full 90 days has to get through.
	repositoryCap := &stubMixRepository{report: &model.TransactionMixReport{}}
	serviceCap := NewTransactionMixService(repositoryCap)

	if _, err := serviceCap.GetMix(
		context.Background(), "06-29-2026", "09-26-2026", "",
	); err != nil {
		t.Errorf("90 day range rejected: %v", err)
	}
	if !repositoryCap.called {
		t.Error("repository was not called for the largest allowed range")
	}

	// One day inside the cap has to get through.
	repository2 := &stubMixRepository{report: &model.TransactionMixReport{}}
	service2 := NewTransactionMixService(repository2)

	if _, err := service2.GetMix(
		context.Background(), "09-19-2026", "09-26-2026", "",
	); err != nil {
		t.Errorf("8 day range rejected: %v", err)
	}
	if !repository2.called {
		t.Error("repository was not called for a valid range")
	}
}

func TestGetMixDefaultsChannelToSwitch(t *testing.T) {
	repository := &stubMixRepository{report: &model.TransactionMixReport{}}
	service := NewTransactionMixService(repository)

	if _, err := service.GetMix(
		context.Background(), "09-25-2026", "09-26-2026", "",
	); err != nil {
		t.Fatalf("GetMix: %v", err)
	}

	if repository.channel != "switch" {
		t.Errorf("channel = %q, want switch", repository.channel)
	}
}

func TestGetMixAcceptsKnownChannelsAndRejectsOthers(t *testing.T) {
	for _, channel := range []string{"switch", "atm", "pos"} {
		repository := &stubMixRepository{report: &model.TransactionMixReport{}}
		service := NewTransactionMixService(repository)

		if _, err := service.GetMix(
			context.Background(), "09-25-2026", "09-26-2026", channel,
		); err != nil {
			t.Errorf("channel %q rejected: %v", channel, err)
		}
		if repository.channel != channel {
			t.Errorf("channel = %q, want %q", repository.channel, channel)
		}
	}

	repository := &stubMixRepository{}
	service := NewTransactionMixService(repository)

	if _, err := service.GetMix(
		context.Background(), "09-25-2026", "09-26-2026", "carrier-pigeon",
	); err != common.ErrInvalidSuccessChannel {
		t.Errorf("err = %v, want ErrInvalidSuccessChannel", err)
	}
	if repository.called {
		t.Error("repository was called with an unknown channel")
	}
}

func TestGetMixNormalisesSlashDatesToDash(t *testing.T) {
	repository := &stubMixRepository{report: &model.TransactionMixReport{}}
	service := NewTransactionMixService(repository)

	if _, err := service.GetMix(
		context.Background(), "09/20/2026", "09/26/2026", "",
	); err != nil {
		t.Fatalf("GetMix: %v", err)
	}

	// The frontend compares the echoed range against MM-DD-YYYY, so the format
	// has to be normalised here regardless of what the caller sent.
	if repository.dateFrom != "09-20-2026" || repository.dateTo != "09-26-2026" {
		t.Errorf(
			"range = %s..%s, want 09-20-2026..09-26-2026",
			repository.dateFrom, repository.dateTo,
		)
	}
}

func TestGetMixReturnsEmptySlicesWhenRepositoryHasNoReport(t *testing.T) {
	repository := &stubMixRepository{}
	service := NewTransactionMixService(repository)

	report, err := service.GetMix(
		context.Background(), "09-25-2026", "09-26-2026", "",
	)
	if err != nil {
		t.Fatalf("GetMix: %v", err)
	}

	// The frontend iterates these directly, so they must not be null.
	if report.ByScheme == nil || report.ByRouting == nil || report.ByType == nil {
		t.Error("axes are nil; the frontend would need null checks")
	}
}

func TestGetMixFillsInMissingAxesOnAPopulatedReport(t *testing.T) {
	repository := &stubMixRepository{report: &model.TransactionMixReport{
		TotalCount: 42,
	}}
	service := NewTransactionMixService(repository)

	report, err := service.GetMix(
		context.Background(), "09-25-2026", "09-26-2026", "",
	)
	if err != nil {
		t.Fatalf("GetMix: %v", err)
	}

	if report.TotalCount != 42 {
		t.Errorf("TotalCount = %d, want 42", report.TotalCount)
	}
	if report.ByScheme == nil || report.ByRouting == nil || report.ByType == nil {
		t.Error("axes are nil; the frontend would need null checks")
	}
}

func TestGetMixWithoutRepositoryReportsOracleUnavailable(t *testing.T) {
	service := NewTransactionMixService(nil)

	_, err := service.GetMix(context.Background(), "09-25-2026", "09-26-2026", "")
	if err != common.ErrOracleUnavailable {
		t.Errorf("err = %v, want ErrOracleUnavailable", err)
	}
}
