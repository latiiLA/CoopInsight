package service

import (
	"math"
	"testing"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

func TestParseIPMSettlementAmount(t *testing.T) {
	signed, abs, ok := parseIPMSettlementAmount("C0000000002200000", 2)
	if !ok || abs != 22000 || signed != 22000 {
		t.Fatalf("credits: signed=%v abs=%v ok=%v", signed, abs, ok)
	}
	signed, abs, ok = parseIPMSettlementAmount("D0000000000000000", 2)
	if !ok || abs != 0 || signed != 0 {
		t.Fatalf("zero debit: signed=%v abs=%v ok=%v", signed, abs, ok)
	}
	signed, abs, ok = parseIPMSettlementAmount("C0000000000013335", 2)
	if !ok || math.Abs(abs-133.35) > 0.001 {
		t.Fatalf("recon net: abs=%v", abs)
	}
	_, _, ok = parseIPMSettlementAmount("", 2)
	if ok {
		t.Fatal("empty should fail")
	}
}

func TestAnnotateMastercardUnsettled_NearestDayAmount(t *testing.T) {
	// Clearing on 28th for 22000 ETB; settlement file date 29th with PDS 0381 credits.
	clearing := []model.UnsettledTransaction{
		{
			ID: 1, TxnDate: "2026-09-28", Date: "2026-09-28",
			Amount: 22000, Currency: 230, STAN: "111111",
			TxnSource: "487016", TxnDest: "9555555555",
		},
		{
			ID: 2, TxnDate: "2026-09-28", Date: "2026-09-28",
			Amount: 500, Currency: 230, STAN: "222222",
		},
	}
	summaries := []model.MastercardIPMTransaction{
		{
			FunctionCode:             "680",
			MessageType:              model.IPMMessageSettlementSummary,
			CurrencyCode:             "230",
			DestinationInstitutionID: "034457",
			OriginatorInstitutionID:  "034457",
			FileID:                   "0032609290000003445702201",
			TransactionDate:          time.Date(2026, 9, 29, 0, 0, 0, 0, time.UTC),
			BusinessKey:              "file|2|680",
			PDS: map[string]string{
				"0380": "D0000000000000000",
				"0381": "C0000000002200000",
				"0384": "C0000000002200000",
				"0148": "2302",
				"0402": "0000000001",
			},
		},
	}

	got := annotateMastercardUnsettled(clearing, summaries)
	if len(got) != 2 {
		t.Fatalf("len=%d", len(got))
	}
	if got[0].MatchStatus != mcMatchStatusMatched {
		t.Fatalf("txn1 status=%s note=%s", got[0].MatchStatus, got[0].MatchNote)
	}
	if got[0].MatchedSettlementDate != "2026-09-29" {
		t.Fatalf("matched date=%s", got[0].MatchedSettlementDate)
	}
	if got[0].MatchedAmountField != "0381" {
		t.Fatalf("field=%s", got[0].MatchedAmountField)
	}
	if math.Abs(got[0].MatchedAmount-22000) > 0.01 {
		t.Fatalf("matched amount=%v", got[0].MatchedAmount)
	}
	if got[1].MatchStatus != mcMatchStatusUnmatched {
		t.Fatalf("txn2 should be unmatched, got %s", got[1].MatchStatus)
	}
}

func TestAnnotateMastercardUnsettled_SumMatch(t *testing.T) {
	clearing := []model.UnsettledTransaction{
		{ID: 1, TxnDate: "2026-09-28", Amount: 10000, Currency: 230},
		{ID: 2, TxnDate: "2026-09-28", Amount: 12000, Currency: 230},
	}
	summaries := []model.MastercardIPMTransaction{
		{
			FunctionCode:    "680",
			MessageType:     model.IPMMessageSettlementSummary,
			CurrencyCode:    "230",
			TransactionDate: time.Date(2026, 9, 29, 0, 0, 0, 0, time.UTC),
			BusinessKey:     "file|2|680",
			PDS: map[string]string{
				"0381": "C0000000002200000",
				"0148": "2302",
			},
		},
	}

	got := annotateMastercardUnsettled(clearing, summaries)
	for i, row := range got {
		if row.MatchStatus != mcMatchStatusMatched {
			t.Fatalf("row %d status=%s note=%s", i, row.MatchStatus, row.MatchNote)
		}
		if row.MatchNote == "" || row.MatchedAmountField != "0381" {
			t.Fatalf("row %d note=%s field=%s", i, row.MatchNote, row.MatchedAmountField)
		}
	}
}

func TestAnnotateMastercardUnsettled_PreferSameDay(t *testing.T) {
	clearing := []model.UnsettledTransaction{
		{ID: 1, TxnDate: "2026-09-28", Amount: 1000, Currency: 230},
	}
	summaries := []model.MastercardIPMTransaction{
		{
			FunctionCode:    "680",
			MessageType:     model.IPMMessageSettlementSummary,
			CurrencyCode:    "230",
			TransactionDate: time.Date(2026, 9, 30, 0, 0, 0, 0, time.UTC),
			BusinessKey:     "a|1|680",
			PDS:             map[string]string{"0381": "C0000000000100000", "0148": "2302"},
		},
		{
			FunctionCode:    "680",
			MessageType:     model.IPMMessageSettlementSummary,
			CurrencyCode:    "230",
			TransactionDate: time.Date(2026, 9, 28, 0, 0, 0, 0, time.UTC),
			BusinessKey:     "b|1|680",
			PDS:             map[string]string{"0381": "C0000000000100000", "0148": "2302"},
		},
	}

	got := annotateMastercardUnsettled(clearing, summaries)
	if got[0].MatchStatus != mcMatchStatusMatched || got[0].MatchedSettlementDate != "2026-09-28" {
		t.Fatalf("expected same-day match, got status=%s date=%s", got[0].MatchStatus, got[0].MatchedSettlementDate)
	}
}

// 385 + 100 = 485: both clearing rows must be sum-matched to the 485 settlement total.
func TestAnnotateMastercardUnsettled_SubsetSumExact_385Plus100(t *testing.T) {
	clearing := []model.UnsettledTransaction{
		{ID: 1, TxnDate: "2026-09-21", Amount: 385, Currency: 230},
		{ID: 2, TxnDate: "2026-09-21", Amount: 100, Currency: 230},
		// Leftover on same day must stay unmatched (not dragged into the 485 set).
		{ID: 3, TxnDate: "2026-09-21", Amount: 3229, Currency: 230},
	}
	summaries := []model.MastercardIPMTransaction{
		{
			FunctionCode:    "680",
			MessageType:     model.IPMMessageSettlementSummary,
			CurrencyCode:    "230",
			TransactionDate: time.Date(2026, 9, 23, 0, 0, 0, 0, time.UTC),
			BusinessKey:     "file|485|680",
			PDS: map[string]string{
				"0381": "C0000000000048500",
				"0148": "2302",
			},
		},
	}

	got := annotateMastercardUnsettled(clearing, summaries)
	if got[0].MatchStatus != mcMatchStatusMatched || got[1].MatchStatus != mcMatchStatusMatched {
		t.Fatalf("385+100 should both match: statuses=%s,%s notes=%s | %s",
			got[0].MatchStatus, got[1].MatchStatus, got[0].MatchNote, got[1].MatchNote)
	}
	if math.Abs(got[0].MatchedAmount-485) > 0.01 || math.Abs(got[1].MatchedAmount-485) > 0.01 {
		t.Fatalf("matched amounts want 485, got %v and %v", got[0].MatchedAmount, got[1].MatchedAmount)
	}
	if got[0].MatchMode != "sum" || got[1].MatchMode != "sum" {
		t.Fatalf("match modes=%s/%s", got[0].MatchMode, got[1].MatchMode)
	}
	if math.Abs(got[0].MatchedClearingAmount-385) > 0.01 || math.Abs(got[1].MatchedClearingAmount-100) > 0.01 {
		t.Fatalf("clearing amounts=%v/%v", got[0].MatchedClearingAmount, got[1].MatchedClearingAmount)
	}
	if got[0].MatchedSettlementDate != "2026-09-23" || got[1].MatchedSettlementDate != "2026-09-23" {
		t.Fatalf("settlement date=%s/%s", got[0].MatchedSettlementDate, got[1].MatchedSettlementDate)
	}
	if got[2].MatchStatus != mcMatchStatusUnmatched {
		t.Fatalf("3229 leftover must stay unmatched, got %s", got[2].MatchStatus)
	}
}

// A lone 385 must NOT be marked matched against a 485 settlement total.
func TestAnnotateMastercardUnsettled_SingleDoesNotMatchLargerTotal(t *testing.T) {
	clearing := []model.UnsettledTransaction{
		{ID: 1, TxnDate: "2026-09-21", Amount: 385, Currency: 230},
	}
	summaries := []model.MastercardIPMTransaction{
		{
			FunctionCode:    "680",
			MessageType:     model.IPMMessageSettlementSummary,
			CurrencyCode:    "230",
			TransactionDate: time.Date(2026, 9, 23, 0, 0, 0, 0, time.UTC),
			BusinessKey:     "file|485|680",
			PDS: map[string]string{
				"0381": "C0000000000048500",
				"0148": "2302",
			},
		},
	}

	got := annotateMastercardUnsettled(clearing, summaries)
	if got[0].MatchStatus != mcMatchStatusUnmatched {
		t.Fatalf("385 alone vs 485 must be unmatched, got %s note=%s matchedAmount=%v",
			got[0].MatchStatus, got[0].MatchNote, got[0].MatchedAmount)
	}
}

// 1200 (and 9100) must not match a 74300 settlement when amounts do not equal or sum to it.
func TestAnnotateMastercardUnsettled_NonMatchingAmountsStayUnsettled(t *testing.T) {
	clearing := []model.UnsettledTransaction{
		{ID: 1, TxnDate: "2026-09-17", Amount: 1200, Currency: 230},
		{ID: 2, TxnDate: "2026-09-17", Amount: 9100, Currency: 230},
	}
	summaries := []model.MastercardIPMTransaction{
		{
			FunctionCode:    "680",
			MessageType:     model.IPMMessageSettlementSummary,
			CurrencyCode:    "230",
			TransactionDate: time.Date(2026, 9, 19, 0, 0, 0, 0, time.UTC),
			BusinessKey:     "file|74300|680",
			PDS: map[string]string{
				"0381": "C0000000007430000",
				"0148": "2302",
			},
		},
	}

	got := annotateMastercardUnsettled(clearing, summaries)
	for i, row := range got {
		if row.MatchStatus != mcMatchStatusUnmatched {
			t.Fatalf("row %d amount=%v must be unmatched vs 74300, got %s note=%s matchedAmount=%v",
				i, row.Amount, row.MatchStatus, row.MatchNote, row.MatchedAmount)
		}
	}
}

// 1200+9100=10300 must match 685 Financial position 10300; the co-present
// 680 currency summary of 74300 must not steal that match (Matched settl.
// amount should be 10300 from 685, not 74300).
func TestAnnotateMastercardUnsettled_Prefer685FinancialPositionOver680(t *testing.T) {
	clearing := []model.UnsettledTransaction{
		{ID: 1, TxnDate: "2026-09-18", Amount: 1200, Currency: 230},
		{ID: 2, TxnDate: "2026-09-18", Amount: 9100, Currency: 230},
	}
	summaries := []model.MastercardIPMTransaction{
		{
			FunctionCode:    "680",
			MessageType:     model.IPMMessageSettlementSummary,
			CurrencyCode:    "230",
			FileID:          "0032609180000003445702201",
			TransactionDate: time.Date(2026, 9, 18, 0, 0, 0, 0, time.UTC),
			BusinessKey:     "file|74300|680",
			PDS: map[string]string{
				"0381": "C0000000007430000",
				"0148": "2302",
			},
		},
		{
			FunctionCode:    "685",
			MessageType:     model.IPMMessageSettlementSummary,
			CurrencyCode:    "230",
			FileID:          "0032609180000003445702201",
			TransactionDate: time.Date(2026, 9, 18, 0, 0, 0, 0, time.UTC),
			BusinessKey:     "file|10300|685",
			PDS: map[string]string{
				"0381": "C0000000001030000",
				"0148": "2302",
			},
		},
	}

	got := annotateMastercardUnsettled(clearing, summaries)
	for i, row := range got {
		if row.MatchStatus != mcMatchStatusMatched {
			t.Fatalf("row %d amount=%v should match 685 10300, got %s note=%s",
				i, row.Amount, row.MatchStatus, row.MatchNote)
		}
		if row.MatchedFunctionCode != "685" {
			t.Fatalf("row %d MatchedFunctionCode=%s want 685", i, row.MatchedFunctionCode)
		}
		if math.Abs(row.MatchedAmount-10300) > 0.01 {
			t.Fatalf("row %d MatchedAmount=%v want 10300 (685), not 74300", i, row.MatchedAmount)
		}
		if row.MatchMode != "sum" {
			t.Fatalf("row %d MatchMode=%s want sum", i, row.MatchMode)
		}
		if math.Abs(row.FinancialPositionTotal-10300) > 0.01 {
			t.Fatalf("row %d FinancialPositionTotal=%v want 10300", i, row.FinancialPositionTotal)
		}
		if row.FinancialPositionField != "0381" {
			t.Fatalf("row %d FinancialPositionField=%s", i, row.FinancialPositionField)
		}
	}
}

