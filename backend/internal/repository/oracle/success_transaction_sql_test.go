package oracle

import (
	"strings"
	"testing"
)

// Golden routing strings — freeze the business predicates so a clarity refactor
// cannot silently change which rows count for each channel/flow.

func TestRoutingFilterATMFlows(t *testing.T) {
	cases := map[string]string{
		"onus":      `TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) = 'CBOBCORTEX'`,
		"offus":     `TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')`,
		"issuing":   `TRIM(t.ACQUIRER) = '1000000010' AND TRIM(t.TXNDEST) = 'CBOBCORTEX'`,
		"acquiring": `TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('CBOBCORTEX', '8888888888', '04', '05')`,
		"overall":   `((TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('CBOBCORTEX', '8888888888', '04', '05')) OR (TRIM(t.ACQUIRER) = '1000000010' AND TRIM(t.TXNDEST) = 'CBOBCORTEX'))`,
	}
	for flow, want := range cases {
		if got := routingFilterFor("atm", flow); got != want {
			t.Errorf("atm/%s:\n got %s\nwant %s", flow, got, want)
		}
	}
	// Unknown flow defaults to acquiring.
	if got := routingFilterFor("atm", ""); got != cases["acquiring"] {
		t.Errorf("atm/default = %s, want acquiring", got)
	}
}

func TestRoutingFilterPOSFlows(t *testing.T) {
	onus := `TRIM(t.TXNDEST) = 'CBOBCORTEX' AND TRIM(t.TXNSRC) = '402032'`
	offus := `TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')`
	issuing := `TRIM(t.ACQUIRER) = '1000000010' AND TRIM(t.TXNDEST) = 'CBOBCORTEX' AND TRIM(t.TXNSRC) <> '402032'`

	cases := map[string]string{
		"onus":      onus,
		"offus":     offus,
		"issuing":   issuing,
		"acquiring": `((` + onus + `) OR (` + offus + `))`,
		"overall":   `((` + onus + `) OR (` + offus + `) OR (` + issuing + `))`,
	}
	for flow, want := range cases {
		if got := routingFilterFor("pos", flow); got != want {
			t.Errorf("pos/%s:\n got %s\nwant %s", flow, got, want)
		}
	}
}

func TestRoutingFilterSwitchScopesByMerchantType(t *testing.T) {
	atm := routingFilterFor("atm", "onus")
	pos := routingFilterFor("pos", "onus")
	want := `((t.MERCHANT_TYPE = 6011 AND (` + atm + `)) OR (t.MERCHANT_TYPE <> 6011 AND (` + pos + `)))`
	if got := routingFilterFor("switch", "onus"); got != want {
		t.Errorf("switch/onus:\n got %s\nwant %s", got, want)
	}
}

func TestChannelFilters(t *testing.T) {
	msg, merch, route := channelFilters("atm", "onus")
	if msg != msgTypesATM {
		t.Errorf("atm msgType = %s", msg)
	}
	if merch != "t.MERCHANT_TYPE = 6011" {
		t.Errorf("atm merchant = %s", merch)
	}
	if route != routingOnus("atm") {
		t.Errorf("atm routing mismatch")
	}

	msg, merch, _ = channelFilters("pos", "acquiring")
	if msg != msgTypesPOS || merch != "t.MERCHANT_TYPE <> 6011" {
		t.Errorf("pos filters = %s / %s", msg, merch)
	}

	msg, merch, _ = channelFilters("switch", "overall")
	if msg != msgTypesSwitch || merch != "1=1" {
		t.Errorf("switch filters = %s / %s", msg, merch)
	}
}

func TestApprovedRespCodesUnchanged(t *testing.T) {
	want := `'0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915'`
	if approvedRespCodes != want {
		t.Error("approvedRespCodes changed — do not alter without product sign-off")
	}
}

func TestTrulyApprovedExprFormula(t *testing.T) {
	got := trulyApprovedExpr()
	if !strings.Contains(got, "t.respcode IN ("+approvedRespCodes+")") {
		t.Error("trulyApproved missing approvedRespCodes list")
	}
	if !strings.Contains(got, "rev.refnum IS NULL") {
		t.Error("trulyApproved must require no matching reversal")
	}
	if !strings.Contains(got, "t.respcode IN ('5','8')") {
		t.Error("trulyApproved must treat offus 5/8 as approved")
	}
	if !strings.Contains(got, offusRoutingExpr()) {
		t.Error("trulyApproved must scope 5/8 to offus routing")
	}

	// Outer parens keep AND/OR safe when injected as AND <expr>.
	want := `((t.respcode IN (` + approvedRespCodes + `) AND rev.refnum IS NULL)` +
		` OR (t.respcode IN ('5','8') AND rev.refnum IS NULL AND (` + offusRoutingExpr() + `)))`
	if got != want {
		t.Errorf("trulyApprovedExpr changed:\n got %s\nwant %s", got, want)
	}
}

func TestApprovedThenReversedExprFormula(t *testing.T) {
	want := `((t.respcode IN (` + approvedRespCodes + `) AND rev.refnum IS NOT NULL)` +
		` OR (t.respcode IN ('5','8') AND rev.refnum IS NOT NULL AND (` + offusRoutingExpr() + `)))`
	if got := approvedThenReversedExpr(); got != want {
		t.Errorf("approvedThenReversedExpr changed:\n got %s\nwant %s", got, want)
	}
}

func TestReversalsCTEPads(t *testing.T) {
	reportCTE := reversalsCTE(2)
	if !strings.Contains(reportCTE, "MSGTYPE IN (410, 420, 430)") {
		t.Error("reversals CTE missing reversal message types")
	}
	if !strings.Contains(reportCTE, "SELECT /*+ MATERIALIZE */") {
		t.Error("reversals CTE must MATERIALIZE for the hash-join plan")
	}
	if !strings.Contains(reportCTE, "TO_DATE(:date_to, 'MM-DD-YYYY') + 2") {
		t.Error("report/trend reversals pad must stay +2")
	}

	listCTE := reversalsCTE(1)
	if !strings.Contains(listCTE, "TO_DATE(:date_to, 'MM-DD-YYYY') + 1") {
		t.Error("list reversals pad must stay +1")
	}
}

func TestSuccessTransactionQueryAssemblesSharedPieces(t *testing.T) {
	q := successTransactionQuery(msgTypesATM, "t.MERCHANT_TYPE = 6011", routingOnus("atm"))
	for _, needle := range []string{
		"WITH rev AS (",
		"SELECT /*+ USE_HASH(t rev) */",
		trulyApprovedExpr(),
		approvedThenReversedExpr(),
		"t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY')",
		"TO_DATE(:date_to, 'MM-DD-YYYY') + 2",
		routingOnus("atm"),
	} {
		if !strings.Contains(q, needle) {
			t.Errorf("report query missing %q", needle)
		}
	}
}

func TestSuccessTrendQueryGroupsByPeriod(t *testing.T) {
	period := periodExprFor("day")
	q := successTrendQuery(msgTypesPOS, "t.MERCHANT_TYPE <> 6011", routingOffus("pos"), period)
	if !strings.Contains(q, "GROUP BY "+period) {
		t.Error("trend query missing GROUP BY period")
	}
	if !strings.Contains(q, "ORDER BY "+period) {
		t.Error("trend query missing ORDER BY period")
	}
}

func TestListSuccessTransactionsQueryUsesPlusOnePad(t *testing.T) {
	q := listSuccessTransactionsQuery("atm", "onus", "1=1", "1=1", 100)
	if !strings.Contains(q, "TO_DATE(:date_to, 'MM-DD-YYYY') + 1") {
		t.Error("list query must keep exclusive +1 date bound")
	}
	if strings.Contains(q, "TO_DATE(:date_to, 'MM-DD-YYYY') + 2") {
		t.Error("list query must not use the report +2 reversals pad")
	}
	if !strings.Contains(q, "FETCH FIRST 100 ROWS ONLY") {
		t.Error("list query missing FETCH FIRST limit")
	}
}

func TestSuccessRateQueriesUseExplicitNullHandling(t *testing.T) {
	queries := []string{
		successTransactionQuery(msgTypesATM, "t.MERCHANT_TYPE = 6011", routingOnus("atm")),
		successTrendQuery(msgTypesPOS, "t.MERCHANT_TYPE <> 6011", routingOffus("pos"), periodExprFor("day")),
		listSuccessTransactionsQuery("atm", "onus", "1=1", "1=1", 100),
	}
	for _, q := range queries {
		if strings.Contains(q, "NVL(") {
			t.Errorf("success-rate query still uses NVL:\\n%s", q)
		}
	}

	report := queries[0]
	for _, needle := range []string{
		"CASE WHEN COUNT(*) = 0 THEN 0",
		"SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END)",
		"t.amount IS NOT NULL THEN t.amount ELSE 0 END",
	} {
		if !strings.Contains(report, needle) {
			t.Errorf("report query missing explicit null handling %q", needle)
		}
	}

	list := queries[2]
	for _, needle := range []string{
		"TRIM(t.REFNUM) AS refnum",
		"CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END AS amount",
		"CASE WHEN t.MERCHANT_TYPE IS NULL THEN 0 ELSE t.MERCHANT_TYPE END AS merchant_type",
	} {
		if !strings.Contains(list, needle) {
			t.Errorf("detail query missing clear replacement %q", needle)
		}
	}
}

func TestNamedRoutingHelpersMatchFilterFor(t *testing.T) {
	for _, channel := range []string{"atm", "pos"} {
		for _, flow := range []string{"onus", "offus", "issuing", "acquiring", "overall"} {
			var named string
			switch flow {
			case "onus":
				named = routingOnus(channel)
			case "offus":
				named = routingOffus(channel)
			case "issuing":
				named = routingIssuing(channel)
			case "acquiring":
				named = routingAcquiring(channel)
			case "overall":
				named = routingOverall(channel)
			}
			if got := routingFilterFor(channel, flow); got != named {
				t.Errorf("%s/%s: routingFilterFor != named helper", channel, flow)
			}
		}
	}
}
