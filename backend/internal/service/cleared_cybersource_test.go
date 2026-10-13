package service

import (
	"context"
	"testing"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type clearedCybersourceUnclearedRepo struct {
	msgType   int64
	sourceBin int64
	destBin   int64
	rows      []model.UnclearedTransaction
}

func (r *clearedCybersourceUnclearedRepo) List(
	_ context.Context,
	msgType int64,
	_, _ string,
	sourceBin, destBin int64,
	page, pageSize int,
) ([]model.UnclearedTransaction, bool, error) {
	r.msgType = msgType
	r.sourceBin = sourceBin
	r.destBin = destBin
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 500
	}
	start := (page - 1) * pageSize
	if start >= len(r.rows) {
		return []model.UnclearedTransaction{}, false, nil
	}
	end := start + pageSize
	hasMore := end < len(r.rows)
	if end > len(r.rows) {
		end = len(r.rows)
	}
	return append([]model.UnclearedTransaction{}, r.rows[start:end]...), hasMore, nil
}

func (r *clearedCybersourceUnclearedRepo) ListExcludingSettled(
	ctx context.Context,
	msgType int64,
	dateFrom, dateTo string,
	sourceBin, destBin int64,
	page, pageSize int,
	_ []string,
) ([]model.UnclearedTransaction, bool, error) {
	return r.List(ctx, msgType, dateFrom, dateTo, sourceBin, destBin, page, pageSize)
}

func TestListVisaCybersourceUsesUnclearedOracleFetch(t *testing.T) {
	repo := &clearedCybersourceUnclearedRepo{
		rows: []model.UnclearedTransaction{
			{ID: 1, TxnID: "386247416095665", Date: "2026-09-13", TxnDate: "2026-09-04", Amount: 50},
			{ID: 2, TxnID: "386247416095666", Date: "2026-09-13", TxnDate: "2026-09-04", Amount: 75},
		},
	}
	svc := NewClearedService(nil, repo)

	got, err := svc.ListVisaCybersource(context.Background(), "09/13/2026", "09/13/2026", 1, 500)
	if err != nil {
		t.Fatalf("ListVisaCybersource: %v", err)
	}
	if repo.msgType != 230 || repo.sourceBin != 408158 || repo.destBin != 9444444444 {
		t.Fatalf("oracle fetch args = msg %d bins %d/%d, want 230 408158/9444444444", repo.msgType, repo.sourceBin, repo.destBin)
	}
	if len(got.Items) != 2 {
		t.Fatalf("got %d rows, want 2", len(got.Items))
	}
	if got.Items[0].TxnID != "386247416095665" || got.Items[0].Date != "2026-09-13" {
		t.Fatalf("first row = %+v", got.Items[0])
	}
}
