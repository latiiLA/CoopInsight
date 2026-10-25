package service

import (
	"strings"
	"testing"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

func TestParseSwitchTxnSearchArgs_UndatedCardUsesWindow(t *testing.T) {
	req, page, pageSize, windowed, err := parseSwitchTxnSearchArgs(
		model.SwitchTransactionSearchRequest{Card: "424312XXXXXX3877"},
		1,
		100,
	)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if page != 1 || pageSize != 100 {
		t.Fatalf("page=%d pageSize=%d", page, pageSize)
	}
	if !windowed {
		t.Fatal("expected windowed lookup")
	}
	if req.DateFrom == "" || req.DateTo == "" {
		t.Fatal("expected applied date window")
	}
	from, _ := time.Parse("01-02-2006", req.DateFrom)
	to, _ := time.Parse("01-02-2006", req.DateTo)
	days := int(to.Sub(from).Hours()/24) + 1
	if days < 1 || days > switchTxnLookupWindowDays+1 {
		t.Fatalf("window days=%d from=%s to=%s", days, req.DateFrom, req.DateTo)
	}
}

func TestParseSwitchTxnSearchArgs_ExplicitRangeNotWindowed(t *testing.T) {
	_, _, _, windowed, err := parseSwitchTxnSearchArgs(
		model.SwitchTransactionSearchRequest{
			Card:     "4243123877",
			DateFrom: "01/01/2026",
			DateTo:   "01/31/2026",
		},
		1,
		50,
	)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if windowed {
		t.Fatal("user-picked range must not enable hasMoreOlder")
	}
}

func TestParseSwitchTxnSearchArgs_LookupWindowOlderChunk(t *testing.T) {
	_, _, _, windowed, err := parseSwitchTxnSearchArgs(
		model.SwitchTransactionSearchRequest{
			Card:         "4243123877",
			DateFrom:     "09/25/2026",
			DateTo:       "10/01/2026",
			LookupWindow: true,
		},
		1,
		100,
	)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !windowed {
		t.Fatal("lookupWindow older chunk should stay windowed")
	}
}

func TestParseSwitchTxnSearchArgs_NeedsCriteria(t *testing.T) {
	_, _, _, _, err := parseSwitchTxnSearchArgs(
		model.SwitchTransactionSearchRequest{},
		1,
		100,
	)
	if err != common.ErrSwitchTxnSearchNeedsCriteria {
		t.Fatalf("got %v want needs criteria", err)
	}
}

func TestSwitchTxnCanExtendOlder(t *testing.T) {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	recent := today.AddDate(0, 0, -10).Format("01-02-2006")
	if !switchTxnCanExtendOlder(recent) {
		t.Fatalf("recent from %s should allow older", recent)
	}
	old := today.AddDate(0, -switchTxnLookupMaxMonths, 0).Format("01-02-2006")
	if switchTxnCanExtendOlder(old) {
		t.Fatalf("floor from %s should not allow older", old)
	}
}

func TestParseSwitchTxnSearchArgs_KeepsCardRaw(t *testing.T) {
	req, _, _, _, err := parseSwitchTxnSearchArgs(
		model.SwitchTransactionSearchRequest{Card: " 424312XXXXXX3877 "},
		0,
		0,
	)
	if err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(req.Card) != "424312XXXXXX3877" {
		t.Fatalf("card=%q", req.Card)
	}
}
