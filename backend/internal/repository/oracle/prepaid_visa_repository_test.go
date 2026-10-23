package oracle

import (
	"os"
	"strings"
	"testing"
)

func TestPrepaidVisaQueriesMaskPan(t *testing.T) {
	if strings.Contains(prepaidVisaCardSelect, "c.PAN") && !strings.Contains(prepaidVisaCardSelect, "PAN_DISPLAY") {
		t.Error("raw PAN must not be projected")
	}
	if !strings.Contains(prepaidVisaCardSelect, "SUBSTR(c.PAN_DISPLAY, 1, 6)") {
		t.Error("PAN_DISPLAY is not masked with a leading SUBSTR")
	}
	if !strings.Contains(prepaidVisaCardSelect, "SUBSTR(c.PAN_DISPLAY, -4)") {
		t.Error("PAN_DISPLAY is not masked with a trailing SUBSTR")
	}
}

func TestPrepaidVisaProductIDList(t *testing.T) {
	if got := prepaidVisaProductIDList("401"); got != "85" {
		t.Fatalf("401 -> %q", got)
	}
	if got := prepaidVisaProductIDList("402"); got != "86" {
		t.Fatalf("402 -> %q", got)
	}
	if got := prepaidVisaProductIDList(""); got != "85, 86" {
		t.Fatalf("all -> %q", got)
	}
	if got := prepaidVisaProductIDList("401'; DROP TABLE"); got != "85, 86" {
		t.Fatalf("injection must fall back to both ids, got %q", got)
	}
}

func TestPrepaidVisaProductFilter(t *testing.T) {
	if got := prepaidVisaProductFilter("p", "401"); !strings.Contains(got, "'401'") {
		t.Fatalf("401 filter = %q", got)
	}
	if got := prepaidVisaProductFilter("p", "999"); got != "" {
		t.Fatalf("invalid product should be ignored, got %q", got)
	}
}

func TestPrepaidVisaTlogProductPred(t *testing.T) {
	if got := prepaidVisaTlogProductPred("401"); !strings.Contains(got, "LIKE '401%'") {
		t.Fatalf("401 pred = %q", got)
	}
	if got := prepaidVisaTlogProductPred(""); !strings.Contains(got, "LIKE '402%'") {
		t.Fatalf("all pred = %q", got)
	}
}

func TestPrepaidVisaReversalAmountsAreSigned(t *testing.T) {
	if !strings.Contains(prepaidVisaSignedAmtBill, "MSGCLS IN (4, 410, 420, 430)") {
		t.Fatal("signed AMTBILL must flip reversal MSGCLS 4 / 410/420/430")
	}
	if strings.Contains(prepaidVisaSignedAmtBill, "MSGTYPE") {
		t.Fatal("cortex.tlog uses MSGCLS, not MSGTYPE")
	}
	if !strings.Contains(prepaidVisaSignedAmtBill, "-NVL(t.AMTBILL") {
		t.Fatal("signed AMTBILL must negate reversal amounts")
	}
	if !strings.Contains(prepaidVisaSignedAmtTxn, "MSGCLS IN (4, 410, 420, 430)") {
		t.Fatal("signed AMTTXN must flip reversal MSGCLS 4 / 410/420/430")
	}
	if !strings.Contains(prepaidVisaSignedAmtTxn, "-NVL(t.AMTTXN") {
		t.Fatal("signed AMTTXN must negate reversal amounts")
	}
}

func TestPrepaidVisaFromAvailableIncludesReversingPosts(t *testing.T) {
	if strings.Contains(prepaidVisaAmtJoin, "NVL(REV, 0) = 0 THEN AMTAVL") {
		t.Fatal("from-available must include REV=1 reversing AMTAVL posts")
	}
	if !strings.Contains(prepaidVisaAmtJoin, "SUM_AMTAVL") {
		t.Fatal("from-available should aggregate AMTAVL including reversals")
	}
	if !strings.Contains(prepaidVisaAmtJoin, "SUM_UNLOAD_AMTAVL") {
		t.Fatal("amt join must carve unloads into SUM_UNLOAD_AMTAVL")
	}
	if !strings.Contains(prepaidVisaAmtJoin, "TXNCODE, 0) = 210") {
		t.Fatal("unload carve-out must key off TXNCODE 210")
	}
}

func TestPrepaidVisaIsUnload(t *testing.T) {
	if !prepaidVisaIsUnload(0, 0, 210, "") {
		t.Fatal("empty-desc TXNCODE 210 should be unload")
	}
	if prepaidVisaIsUnload(0, 0, 210, "MAIN BRANCH") {
		t.Fatal("TXNCODE 210 with merchant text is not unload")
	}
	if prepaidVisaIsUnload(50, 50, 201, "LOAD ACCOUNT FROM BRANCH") {
		t.Fatal("top-up must not classify as unload")
	}
	if prepaidVisaIsUnload(0, 0, 1, "ATM") {
		t.Fatal("spend TXNCODE 1 must not classify as unload")
	}
}

func TestPrepaidVisaCardIDInList(t *testing.T) {
	if got := prepaidVisaCardIDInList(nil); got != "0" {
		t.Fatalf("nil -> %q", got)
	}
	if got := prepaidVisaCardIDInList([]int64{129828, 169050}); got != "129828, 169050" {
		t.Fatalf("two ids -> %q", got)
	}
	if got := prepaidVisaCardIDInList([]int64{0, -1, 42}); got != "42" {
		t.Fatalf("filters invalid ids, got %q", got)
	}
}

func TestPrepaidVisaDashboardUsesDistinctAccounts(t *testing.T) {
	// Guard against regressing to per-card balance sums that double-count shared wallets.
	src, err := os.ReadFile("prepaid_visa_repository.go")
	if err != nil {
		t.Fatal(err)
	}
	text := string(src)
	if !strings.Contains(text, "acct_stats AS") {
		t.Fatal("dashboard fleet balances must aggregate distinct wallet accounts")
	}
	if !strings.Contains(text, "GROUP BY ACCDET_ID") {
		t.Fatal("dashboard must dedupe by ACCDET_ID before summing balances")
	}
}

func TestPrepaidVisaFromAvailableUsesAmtAvlNotClrbal(t *testing.T) {
	if strings.Contains(prepaidVisaCardSelect, "CLRBAL") {
		t.Fatal("card select must not use accdet.CLRBAL for from-available")
	}
	if !strings.Contains(prepaidVisaCardSelect, "SUM_AMTAVL") {
		t.Fatal("card select should derive from-available from −Σ AMTAVL")
	}
	if !strings.Contains(prepaidVisaCardSelect, "FROM_AVAILABLE") {
		t.Fatal("card select must project FROM_AVAILABLE")
	}
	if !strings.Contains(prepaidVisaAmtJoin, "AMTAVL") || !strings.Contains(prepaidVisaAmtJoin, "AMTBLK") {
		t.Fatal("amt join must aggregate AMTAVL/AMTBLK")
	}
	if !strings.Contains(prepaidVisaCardSelect, "AVAILABLE_AMOUNT") {
		t.Fatal("card select must project Available Amount formula")
	}
	if !strings.Contains(prepaidVisaCardSelect, "SHDWAUTHOV") || !strings.Contains(prepaidVisaCardSelect, "UNCLRCREDIT") {
		t.Fatal("Available Amount must use override and unclear credit terms")
	}
}
