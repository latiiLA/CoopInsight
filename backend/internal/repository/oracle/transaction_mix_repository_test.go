package oracle

import (
	"strings"
	"testing"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

// The mix query reads every row in the range, so the cost of getting it wrong
// is a full scan of the switch log. Two things have to hold: it must not
// restrict MSGTYPE, and the date bound has to be inclusive of dateTo.

func TestTransactionMixQueryDoesNotRestrictMessageType(t *testing.T) {
	upper := strings.ToUpper(transactionMixQuery)

	// The success-rate reports pin MSGTYPE to authorisations. Doing that here
	// would leave the type axis with a single bucket, which is the one thing
	// this report exists to show.
	if strings.Contains(upper, "WHERE") && strings.Contains(upper, "AND T.MSGTYPE") {
		t.Error("query restricts MSGTYPE in the WHERE clause; the type axis would be meaningless")
	}

	// The bucketing CASE has to survive, otherwise nothing groups by type.
	if !strings.Contains(upper, "WHEN T.MSGTYPE IN (210, 110) THEN 'AUTHORISATION'") {
		t.Error("authorisation bucket is missing from the type CASE")
	}
	if !strings.Contains(upper, "WHEN T.MSGTYPE IN (410, 430) THEN 'REVERSAL'") {
		t.Error("reversal bucket is missing from the type CASE")
	}
}

func TestTransactionMixQueryDateBoundIsInclusiveOfEndDate(t *testing.T) {
	// LOCAL_DATE is stored date-only, so an exclusive +1 covers dateTo in full
	// and +2 would add a whole extra day.
	if !strings.Contains(
		transactionMixQuery,
		"TO_DATE(:date_to, 'MM-DD-YYYY') + 1",
	) {
		t.Error("end of range is not an exclusive +1 day bound")
	}
}

func TestTransactionMixQueryGroupsOnAllThreeAxes(t *testing.T) {
	groupBy := strings.ToUpper(transactionMixQuery[strings.Index(
		strings.ToUpper(transactionMixQuery), "GROUP BY",
	):])

	for _, column := range []string{"CARDPRODUCT", "TXNDEST", "MSGTYPE"} {
		if !strings.Contains(groupBy, column) {
			t.Errorf("GROUP BY does not include %s", column)
		}
	}
}

// Each axis has to total the whole population on its own, which is only true if
// every raw row lands in exactly one bucket per axis.

func TestPivotMixSumsEachAxisToTheWholePopulation(t *testing.T) {
	groups := []mixGroup{
		{scheme: "ETB", route: "8888888888", ttype: model.MixTypeAuthorisation, count: 100, amount: 1000, approved: 90},
		{scheme: "ETB", route: "8888888888", ttype: model.MixTypeReversal, count: 10, amount: 100, approved: 0},
		{scheme: "GAMTAA", route: "CBOBCORTEX", ttype: model.MixTypeAuthorisation, count: 80, amount: 500, approved: 70},
		{scheme: "VISA", route: "04", ttype: model.MixTypeAuthorisation, count: 10, amount: 50, approved: 8},
		{scheme: "", route: "", ttype: model.MixTypeNetwork, count: 5, amount: 0, approved: 0},
	}

	report := pivotMix("09-20-2026", "09-26-2026", "switch", 205, 1650, 168, groups)

	if report.TotalCount != 205 {
		t.Errorf("TotalCount = %d, want 205", report.TotalCount)
	}
	if report.TotalAmount != 1650 {
		t.Errorf("TotalAmount = %v, want 1650", report.TotalAmount)
	}
	if report.ApprovedCount != 168 {
		t.Errorf("ApprovedCount = %d, want 168", report.ApprovedCount)
	}

	// Reversals are pulled out of the type axis, and only count reversal rows.
	// The 5 network-management rows are neither, so authorisations must be
	// 190 and not the 195 that "total minus reversals" would give.
	if report.ReversalCount != 10 {
		t.Errorf("ReversalCount = %d, want 10", report.ReversalCount)
	}
	if report.AuthorisationCount != 190 {
		t.Errorf("AuthorisationCount = %d, want 190", report.AuthorisationCount)
	}
	// 10 reversals out of 205 messages.
	if got := report.ReversalPercent; got < 4.87 || got > 4.88 {
		t.Errorf("ReversalPercent = %v, want about 4.88", got)
	}

	for _, axis := range []struct {
		name  string
		total int64
	}{
		{"scheme", sumSegmentCounts(report.ByScheme)},
		{"routing", sumSegmentCounts(report.ByRouting)},
		{"type", sumSliceCounts(report.ByType)},
	} {
		if axis.total != report.TotalCount {
			t.Errorf("%s axis sums to %d, want %d", axis.name, axis.total, report.TotalCount)
		}
	}
}

func TestPivotMixSortsLargestFirst(t *testing.T) {
	groups := []mixGroup{
		{scheme: "VISA", route: "04", ttype: model.MixTypeAuthorisation, count: 5, amount: 50},
		{scheme: "ETB", route: "8888888888", ttype: model.MixTypeAuthorisation, count: 100, amount: 1000},
		{scheme: "GAMTAA", route: "CBOBCORTEX", ttype: model.MixTypeAuthorisation, count: 50, amount: 500},
	}

	report := pivotMix("09-20-2026", "09-26-2026", "switch", 155, 1550, 0, groups)

	got := []string{}
	for _, slice := range report.ByScheme {
		got = append(got, slice.Key)
	}
	want := []string{"ETB", "GAMTAA", "VISA"}

	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("ByScheme order = %v, want %v", got, want)
		}
	}
}

// The routing codes are grouped on how they actually behave in the data, so a
// slice that mixes two codes has to come back as one row.

func TestCanonicalMixRoutingGroupsMastercardCodes(t *testing.T) {
	for _, code := range []string{"05", "06"} {
		key, label := canonicalMixRouting(code)
		if key != "MASTERCARD" || label != "Mastercard" {
			t.Errorf("canonicalMixRouting(%q) = %q/%q, want MASTERCARD/Mastercard", code, key, label)
		}
	}

	// 04 carries only Visa traffic, so it stays separate.
	key, _ := canonicalMixRouting("04")
	if key != "VISA" {
		t.Errorf("canonicalMixRouting(\"04\") = %q, want VISA", key)
	}
}

func TestCanonicalMixRoutingKeepsUnknownCodesVisible(t *testing.T) {
	// A destination added to the switch later must appear in the report rather
	// than being folded into an "other" bucket or dropped.
	key, label := canonicalMixRouting("99")
	if key != "CODE_99" {
		t.Errorf("key = %q, want CODE_99", key)
	}
	if !strings.Contains(label, "99") {
		t.Errorf("label = %q, want it to contain the code", label)
	}

	key, label = canonicalMixRouting("")
	if key != "UNKNOWN" || label != "Not recorded" {
		t.Errorf("blank dest = %q/%q, want UNKNOWN/Not recorded", key, label)
	}
}

func TestCanonicalMixSchemeUsesAppVocabulary(t *testing.T) {
	// The column stores the currency code; every other surface in the app
	// calls the domestic scheme ETH.
	key, label := canonicalMixScheme("ETB")
	if key != "ETB" || label != "ETH" {
		t.Errorf("canonicalMixScheme(\"ETB\") = %q/%q, want ETB/ETH", key, label)
	}

	key, label = canonicalMixScheme("MDS")
	if key != "MASTERCARD" || label != "Mastercard" {
		t.Errorf("canonicalMixScheme(\"MDS\") = %q/%q, want MASTERCARD/Mastercard", key, label)
	}

	// Case and padding vary in the log, so they must not change the bucket.
	key, _ = canonicalMixScheme("  visa  ")
	if key != "VISA" {
		t.Errorf("canonicalMixScheme(\"  visa  \") = %q, want VISA", key)
	}
}

func TestPivotMixWithNoRowsDoesNotDivideByZero(t *testing.T) {
	report := pivotMix("09-20-2026", "09-26-2026", "switch", 0, 0, 0, nil)

	if report.ReversalPercent != 0 {
		t.Errorf("ReversalPercent = %v, want 0 for an empty range", report.ReversalPercent)
	}
	if report.ByScheme == nil || report.ByRouting == nil || report.ByType == nil {
		t.Error("empty axes should be empty slices, not nil")
	}
}

func sumSegmentCounts(segments []model.TransactionMixSegment) int64 {
	var total int64
	for _, segment := range segments {
		total += segment.Count
	}
	return total
}

func sumSliceCounts(slices []model.TransactionMixSlice) int64 {
	var total int64
	for _, slice := range slices {
		total += slice.Count
	}
	return total
}
