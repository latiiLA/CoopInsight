package service

import (
	"math"
	"testing"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

func TestInstitutionSoftMatch_SwitchBinsDoNotBlock(t *testing.T) {
	// Real MDS clearing rows use switch routing bins, not Mastercard IIDs.
	txn := &model.UnsettledTransaction{TxnSource: "487016", TxnDest: "9555555555"}
	if !institutionSoftMatch(txn, "034457") {
		t.Fatal("switch bins must not reject Mastercard institution 034457")
	}
	if !institutionSoftMatch(txn, "") {
		t.Fatal("empty settlement institution should allow")
	}
	txnMatch := &model.UnsettledTransaction{TxnDest: "034457"}
	if !institutionSoftMatch(txnMatch, "34457") {
		t.Fatal("leading-zero stripped Mastercard IID should match")
	}
}

func TestAnnotateMastercardUnsettled_ETBNumericCurrencyAndNextDay(t *testing.T) {
	// Production-shaped row: Oracle currency numeric 230 (ETB), switch bins,
	// clearing 2026-09-28, IPM credits 22000 on file date 2026-09-29.
	// Prefer matching the 685 Financial position over the 680 currency summary
	// when both carry the same amount.
	clearing := []model.UnsettledTransaction{
		{
			ID: 1, TxnDate: "2026-09-28", Date: "2026-09-28",
			Amount: 22000, Currency: 230,
			TxnSource: "487016", TxnDest: "9555555555",
			STAN: "000014",
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
			},
		},
		{
			FunctionCode:             "685",
			MessageType:              model.IPMMessageSettlementSummary,
			CurrencyCode:             "230",
			DestinationInstitutionID: "034457",
			OriginatorInstitutionID:  "034457",
			FileID:                   "0032609290000003445702201",
			TransactionDate:          time.Date(2026, 9, 29, 0, 0, 0, 0, time.UTC),
			BusinessKey:              "file|3|685",
			PDS: map[string]string{
				"0381": "C0000000002200000",
				"0148": "23028402",
			},
		},
	}

	got := annotateMastercardUnsettled(clearing, summaries)
	if got[0].MatchStatus != mcMatchStatusMatched {
		t.Fatalf("status=%s note=%s", got[0].MatchStatus, got[0].MatchNote)
	}
	if got[0].MatchedSettlementDate != "2026-09-29" {
		t.Fatalf("matched date=%s", got[0].MatchedSettlementDate)
	}
	if math.Abs(got[0].MatchedAmount-22000) > 0.01 {
		t.Fatalf("matched amount=%v", got[0].MatchedAmount)
	}
	if got[0].MatchedFunctionCode != "685" {
		t.Fatalf("prefer 685, got %s", got[0].MatchedFunctionCode)
	}
	if math.Abs(got[0].FinancialPositionTotal-22000) > 0.01 {
		t.Fatalf("financial position total=%v want 22000", got[0].FinancialPositionTotal)
	}
	if got[0].FinancialPositionField != "0381" {
		t.Fatalf("financial position field=%s", got[0].FinancialPositionField)
	}
	if got[0].MatchMode != "amount" {
		t.Fatalf("match mode=%s", got[0].MatchMode)
	}
	if math.Abs(got[0].MatchedClearingAmount-22000) > 0.01 {
		t.Fatalf("matched clearing amount=%v", got[0].MatchedClearingAmount)
	}
}

func TestCurrenciesEquivalent_ETB230(t *testing.T) {
	if !currenciesEquivalent("230", "230") {
		t.Fatal("230==230")
	}
	if !currenciesEquivalent("ETB", "230") {
		t.Fatal("ETB should equal 230")
	}
	if !currenciesEquivalent("230", "etb") {
		t.Fatal("230 should equal etb")
	}
	if currenciesEquivalent("840", "230") {
		t.Fatal("USD must not equal ETB")
	}
}
