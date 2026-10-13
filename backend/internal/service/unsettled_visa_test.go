package service

import (
	"context"
	"testing"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type visaUnsettledOracleRepo struct {
	rows []model.UnsettledTransaction
}

func (r *visaUnsettledOracleRepo) List(
	_ context.Context,
	_ int64,
	_, _ string,
	_, _ int64,
	page, pageSize int,
) ([]model.UnsettledTransaction, bool, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 500
	}
	start := (page - 1) * pageSize
	if start >= len(r.rows) {
		return []model.UnsettledTransaction{}, false, nil
	}
	end := start + pageSize
	hasMore := end < len(r.rows)
	if end > len(r.rows) {
		end = len(r.rows)
	}
	return append([]model.UnsettledTransaction{}, r.rows[start:end]...), hasMore, nil
}

func (r *visaUnsettledOracleRepo) ListExcludingSettled(
	ctx context.Context,
	msgType int64,
	dateFrom, dateTo string,
	sourceBin, destBin int64,
	page, pageSize int,
	_ []string,
) ([]model.UnsettledTransaction, bool, error) {
	return r.List(ctx, msgType, dateFrom, dateTo, sourceBin, destBin, page, pageSize)
}

type visaUnsettledSettleRepo struct {
	searchRepo
	settled map[string]struct{}
}

func (s *visaUnsettledSettleRepo) FindSettledTransactionIDsByIDs(_ context.Context, ids []string) ([]string, error) {
	out := make([]string, 0)
	for _, id := range ids {
		if _, ok := s.settled[id]; ok {
			out = append(out, id)
		}
	}
	return out, nil
}

func TestListVisaExcludesSettledByIDWhenDatesDiffer(t *testing.T) {
	oracle := &visaUnsettledOracleRepo{
		rows: []model.UnsettledTransaction{
			{ID: 1, TxnID: "386253529181829", TxnDate: "2026-09-10", Amount: 100},
			{ID: 2, TxnID: "386253529181830", TxnDate: "2026-09-10", Amount: 200},
		},
	}
	settled := &visaUnsettledSettleRepo{
		settled: map[string]struct{}{"386253529181829": {}},
	}
	svc := NewUnsettledService(oracle, settled, nil, nil)

	got, err := svc.ListVisa(context.Background(), "09/10/2026", "09/10/2026", 1, 500)
	if err != nil {
		t.Fatalf("ListVisa: %v", err)
	}
	if len(got.Items) != 1 {
		t.Fatalf("items = %d, want 1 (settled id excluded even if dates differ)", len(got.Items))
	}
	if got.Items[0].TxnID != "386253529181830" {
		t.Fatalf("remaining txn = %q", got.Items[0].TxnID)
	}
	if got.HasMore {
		t.Fatal("HasMore = true, want false")
	}
}

func TestListVisaSameSearchIsStableAfterExclusion(t *testing.T) {
	rows := []model.UnsettledTransaction{
		{ID: 1, TxnID: "id-1"},
		{ID: 2, TxnID: "id-2"},
		{ID: 3, TxnID: "id-3"},
		{ID: 4, TxnID: "id-4"},
		{ID: 5, TxnID: "id-5"},
		{ID: 6, TxnID: "id-6"},
	}

	oracle := &visaUnsettledOracleRepo{rows: rows}
	settled := &visaUnsettledSettleRepo{
		settled: map[string]struct{}{
			"id-2": {},
			"id-4": {},
			"id-6": {},
		},
	}
	svc := NewUnsettledService(oracle, settled, nil, nil)

	first, err := svc.ListVisa(context.Background(), "09/10/2026", "09/10/2026", 1, 2)
	if err != nil {
		t.Fatalf("first ListVisa: %v", err)
	}
	second, err := svc.ListVisa(context.Background(), "09/10/2026", "09/10/2026", 1, 2)
	if err != nil {
		t.Fatalf("second ListVisa: %v", err)
	}
	if len(first.Items) != 2 || len(second.Items) != 2 {
		t.Fatalf("page sizes %d / %d, want 2 / 2", len(first.Items), len(second.Items))
	}
	if first.Items[0].TxnID != second.Items[0].TxnID || first.Items[1].TxnID != second.Items[1].TxnID {
		t.Fatalf("page 1 changed: %q,%q then %q,%q",
			first.Items[0].TxnID, first.Items[1].TxnID,
			second.Items[0].TxnID, second.Items[1].TxnID)
	}
	if first.Items[0].TxnID != "id-1" || first.Items[1].TxnID != "id-3" {
		t.Fatalf("page 1 = %q,%q want id-1,id-3", first.Items[0].TxnID, first.Items[1].TxnID)
	}

	page2, err := svc.ListVisa(context.Background(), "09/10/2026", "09/10/2026", 2, 2)
	if err != nil {
		t.Fatalf("page 2: %v", err)
	}
	if len(page2.Items) != 1 || page2.Items[0].TxnID != "id-5" {
		t.Fatalf("page 2 = %+v want id-5", page2.Items)
	}
	if page2.HasMore {
		t.Fatal("page 2 HasMore = true, want false")
	}
}

func TestListVisaCollectsOracleAtMatchPageSize(t *testing.T) {
	repo := &recordingUnsettledRepo{
		visaUnsettledOracleRepo: visaUnsettledOracleRepo{
			rows: []model.UnsettledTransaction{
				{ID: 1, TxnID: "a"},
				{ID: 2, TxnID: "b"},
			},
		},
	}
	svc := NewUnsettledService(repo, &visaUnsettledSettleRepo{}, nil, nil)
	if _, err := svc.ListVisa(context.Background(), "09/10/2026", "09/10/2026", 1, 500); err != nil {
		t.Fatalf("ListVisa: %v", err)
	}
	if len(repo.pageSizes) == 0 || repo.pageSizes[0] != visaUnsettledCollectPageSize {
		t.Fatalf("oracle page sizes = %v, want first %d", repo.pageSizes, visaUnsettledCollectPageSize)
	}
}

type recordingUnsettledRepo struct {
	visaUnsettledOracleRepo
	pageSizes []int
}

func (r *recordingUnsettledRepo) List(
	ctx context.Context,
	msgType int64,
	dateFrom, dateTo string,
	sourceBin, destBin int64,
	page, pageSize int,
) ([]model.UnsettledTransaction, bool, error) {
	r.pageSizes = append(r.pageSizes, pageSize)
	return r.visaUnsettledOracleRepo.List(ctx, msgType, dateFrom, dateTo, sourceBin, destBin, page, pageSize)
}

func TestExcludeSettledByTxnIDTrimsSpace(t *testing.T) {
	rows := []model.UnsettledTransaction{
		{TxnID: " 386253529181829 "},
		{TxnID: "keep"},
	}
	got := excludeSettledByTxnID(rows, []string{"386253529181829"})
	if len(got) != 1 || got[0].TxnID != "keep" {
		t.Fatalf("got %+v", got)
	}
}

func TestSliceClearingPageHasMore(t *testing.T) {
	all := []int{1, 2, 3, 4, 5}
	page, more := sliceClearingPage(all, 1, 2, false)
	if len(page) != 2 || page[0] != 1 || !more {
		t.Fatalf("page=%v more=%v", page, more)
	}
	page, more = sliceClearingPage(all, 3, 2, false)
	if len(page) != 1 || page[0] != 5 || more {
		t.Fatalf("last page=%v more=%v", page, more)
	}
}
