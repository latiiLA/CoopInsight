package service

import (
	"context"
	"testing"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// searchRepo captures what the search was asked for and returns a fixed result.
type searchRepo struct {
	prefix string
	limit  int
	result []model.VisaSettlementTransaction
	err    error
}

func (s *searchRepo) FindByTransactionIDPrefix(
	_ context.Context,
	prefix string,
	limit int,
) ([]model.VisaSettlementTransaction, error) {
	s.prefix = prefix
	s.limit = limit
	return s.result, s.err
}

func (s *searchRepo) UpsertTransactions(context.Context, []model.VisaSettlementTransaction) (int, int, error) {
	return 0, 0, nil
}
func (s *searchRepo) SaveBatchSummary(context.Context, *model.SettlementBatchSummary) error {
	return nil
}
func (s *searchRepo) FindByDateRange(context.Context, time.Time, time.Time) ([]model.VisaSettlementTransaction, error) {
	return nil, nil
}
func (s *searchRepo) FindByBatchID(context.Context, primitive.ObjectID) ([]model.VisaSettlementTransaction, error) {
	return nil, nil
}
func (s *searchRepo) FindByTransactionID(context.Context, string) (*model.VisaSettlementTransaction, error) {
	return nil, nil
}
func (s *searchRepo) FindByAccountNumber(context.Context, string) ([]model.VisaSettlementTransaction, error) {
	return nil, nil
}
func (s *searchRepo) FindBatchSummaryByID(context.Context, string) (*model.SettlementBatchSummary, error) {
	return nil, nil
}
func (s *searchRepo) ListBatchSummaries(context.Context, int64) ([]model.SettlementBatchSummary, error) {
	return nil, nil
}
func (s *searchRepo) EnsureIndexes(context.Context) error { return nil }
func (s *searchRepo) FindAllSettledTransactionIDs(context.Context) ([]string, error) {
	return nil, nil
}
func (s *searchRepo) FindSettledTransactionIDs(context.Context, time.Time, time.Time) ([]string, error) {
	return nil, nil
}
func (s *searchRepo) FindSettledTransactionIDsByIDs(context.Context, []string) ([]string, error) {
	return nil, nil
}
func (s *searchRepo) FindSettledTransactionsByIDs(context.Context, []string) ([]model.VisaSettlementTransaction, error) {
	return nil, nil
}

func TestSearchByTransactionIDPassesTheQueryThrough(t *testing.T) {
	repo := &searchRepo{}
	svc := NewVisaSettlementService(repo)

	if _, err := svc.SearchByTransactionID(context.Background(), "3862535"); err != nil {
		t.Fatalf("search: %v", err)
	}

	if repo.prefix != "3862535" {
		t.Errorf("prefix = %q, want 3862535", repo.prefix)
	}
	// The cap is what stops a one character query pulling back everything.
	if repo.limit != maxTransactionSearchResults {
		t.Errorf("limit = %d, want %d", repo.limit, maxTransactionSearchResults)
	}
}

func TestSearchByTransactionIDIgnoresSurroundingSpace(t *testing.T) {
	repo := &searchRepo{}
	svc := NewVisaSettlementService(repo)

	if _, err := svc.SearchByTransactionID(context.Background(), "  3862535  "); err != nil {
		t.Fatalf("search: %v", err)
	}

	if repo.prefix != "3862535" {
		t.Errorf("prefix = %q, want the trimmed value 3862535", repo.prefix)
	}
}

// A blank query is a client mistake, so it short circuits rather than issuing a
// match-everything filter.
func TestSearchByTransactionIDReturnsNothingForABlankQuery(t *testing.T) {
	for _, query := range []string{"", "   ", "\t"} {
		repo := &searchRepo{}
		svc := NewVisaSettlementService(repo)

		got, err := svc.SearchByTransactionID(context.Background(), query)
		if err != nil {
			t.Fatalf("query %q: %v", query, err)
		}
		if len(got) != 0 {
			t.Errorf("query %q returned %d records, want 0", query, len(got))
		}
		// The repository must not be reached at all.
		if repo.prefix != "" {
			t.Errorf("query %q reached the repository with %q", query, repo.prefix)
		}
	}
}

func TestSearchByTransactionIDReturnsTheRepositoryResult(t *testing.T) {
	want := []model.VisaSettlementTransaction{
		{ID: primitive.NewObjectID(), TransactionID: "386253526985262"},
		{ID: primitive.NewObjectID(), TransactionID: "386253527558727"},
	}
	repo := &searchRepo{result: want}
	svc := NewVisaSettlementService(repo)

	got, err := svc.SearchByTransactionID(context.Background(), "3862535")
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("got %d records, want 2", len(got))
	}
	if got[0].TransactionID != "386253526985262" {
		t.Errorf("first id = %q", got[0].TransactionID)
	}
}

func TestSearchByTransactionIDPropagatesTheError(t *testing.T) {
	repo := &searchRepo{err: context.Canceled}
	svc := NewVisaSettlementService(repo)

	if _, err := svc.SearchByTransactionID(context.Background(), "3862"); err == nil {
		t.Error("expected the repository error to be returned")
	}
}
