package oracle

import (
	"strconv"
	"strings"
)

// Response-code lists and routing destinations are product rules.
// Do not change approvedRespCodes, dest lists, or the success formula
// unless intentionally fixing a pure formatting issue.

const approvedRespCodes = `'0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915'`

const classifiedRespCodes = `'0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915','4','5','8','9','10','14','19','20','22','23','30','48','56','57','58','68','81','82','87','91','92','93','96','99','102','103','112','113','121','702','801','802','900','903','906','930','990','3','39','811'`

const (
	coopPOSTxnSrcBIN = "402032"

	// Shared destination / acquirer atoms (single source for dest lists).
	acquirerATM      = "1000000011"
	acquirerIssuing  = "1000000010"
	destCortex       = "CBOBCORTEX"
	destOffusSQLList = "'8888888888', '04', '05'"
	destAcquiringSQL = "'CBOBCORTEX', '8888888888', '04', '05'"
)

// ---------------------------------------------------------------------------
// Message-type filters (channel)
// ATM: MSGTYPE 210 only. POS: 110 and 210. Switch: ATM rule OR POS rule by merchant.
// ---------------------------------------------------------------------------

const (
	msgTypesATM    = `t.MSGTYPE = 210`
	msgTypesPOS    = `t.MSGTYPE IN (110, 210)`
	msgTypesSwitch = `((t.MERCHANT_TYPE = 6011 AND t.MSGTYPE = 210) OR (t.MERCHANT_TYPE <> 6011 AND t.MSGTYPE IN (110, 210)))`
)

func msgTypeFilterFor(channel string) string {
	switch channel {
	case "pos":
		return msgTypesPOS
	case "switch":
		return msgTypesSwitch
	default:
		return msgTypesATM
	}
}

// ---------------------------------------------------------------------------
// Merchant-type filters (channel)
// ---------------------------------------------------------------------------

func merchantTypeFilterFor(channel string) string {
	switch channel {
	case "pos":
		return "t.MERCHANT_TYPE <> 6011"
	case "switch":
		return "1=1"
	default:
		return "t.MERCHANT_TYPE = 6011"
	}
}

// ---------------------------------------------------------------------------
// Routing filters by flow: onus / offus / issuing / acquiring / overall
// ATM on-us: acquirer 1000000011 + Cortex.
// POS on-us: Cortex + CoopBank BIN in TXNSRC (402032); POS issuing excludes that set.
// ---------------------------------------------------------------------------

func routingOnus(channel string) string {
	if channel == "pos" {
		return `TRIM(t.TXNDEST) = '` + destCortex + `' AND TRIM(t.TXNSRC) = '` + coopPOSTxnSrcBIN + `'`
	}
	return `TRIM(t.ACQUIRER) = '` + acquirerATM + `' AND TRIM(t.TXNDEST) = '` + destCortex + `'`
}

func routingOffus(channel string) string {
	_ = channel // ATM and POS off-us share the same acquirer/dest rule.
	return `TRIM(t.ACQUIRER) = '` + acquirerATM + `' AND TRIM(t.TXNDEST) IN (` + destOffusSQLList + `)`
}

func routingIssuing(channel string) string {
	if channel == "pos" {
		return `TRIM(t.ACQUIRER) = '` + acquirerIssuing + `' AND TRIM(t.TXNDEST) = '` + destCortex + `' AND TRIM(t.TXNSRC) <> '` + coopPOSTxnSrcBIN + `'`
	}
	return `TRIM(t.ACQUIRER) = '` + acquirerIssuing + `' AND TRIM(t.TXNDEST) = '` + destCortex + `'`
}

func routingAcquiring(channel string) string {
	if channel == "pos" {
		return `((` + routingOnus("pos") + `) OR (` + routingOffus("pos") + `))`
	}
	return `TRIM(t.ACQUIRER) = '` + acquirerATM + `' AND TRIM(t.TXNDEST) IN (` + destAcquiringSQL + `)`
}

func routingOverall(channel string) string {
	if channel == "pos" {
		return `((` + routingOnus("pos") + `) OR (` + routingOffus("pos") + `) OR (` + routingIssuing("pos") + `))`
	}
	return `((TRIM(t.ACQUIRER) = '` + acquirerATM + `' AND TRIM(t.TXNDEST) IN (` + destAcquiringSQL + `)) OR (TRIM(t.ACQUIRER) = '` + acquirerIssuing + `' AND TRIM(t.TXNDEST) = '` + destCortex + `'))`
}

// routingFilterFor returns the flow predicate for atm, pos, or switch.
// Switch = ATM rule OR POS rule, scoped by merchant type so channels do not bleed.
func routingFilterFor(channel, flow string) string {
	if channel == "switch" {
		atm := routingFilterFor("atm", flow)
		pos := routingFilterFor("pos", flow)
		return `((t.MERCHANT_TYPE = 6011 AND (` + atm + `)) OR (t.MERCHANT_TYPE <> 6011 AND (` + pos + `)))`
	}

	base := channel
	if base != "pos" {
		base = "atm"
	}

	switch flow {
	case "onus":
		return routingOnus(base)
	case "offus":
		return routingOffus(base)
	case "issuing":
		return routingIssuing(base)
	case "acquiring":
		return routingAcquiring(base)
	case "overall":
		return routingOverall(base)
	default:
		return routingAcquiring(base)
	}
}

// channelFilters bundles the three WHERE predicates used by every success query.
func channelFilters(channel, flow string) (msgType, merchantType, routing string) {
	return msgTypeFilterFor(channel), merchantTypeFilterFor(channel), routingFilterFor(channel, flow)
}

// ---------------------------------------------------------------------------
// Approval / reversal predicates
// Offus: another switch is the destination, so declines from the issuer's
// switch (respcode 5, 8) are not our switch's fault — count as approved when offus.
// Success = approved respcode (or offus 5/8) and no matching 410/420/430 on REFNUM.
// ---------------------------------------------------------------------------

// offusRoutingExpr matches the shared ATM/POS off-us acquirer/dest rule.
func offusRoutingExpr() string {
	return routingOffus("atm")
}

// trulyApprovedExpr: approved (or offus 5/8) and not reversed.
// Outer parentheses are required so AND/OR precedence cannot let the off-us
// 5/8 branch escape channel/date predicates when this is injected as AND <expr>.
func trulyApprovedExpr() string {
	return `((t.respcode IN (` + approvedRespCodes + `) AND rev.refnum IS NULL)` +
		` OR (t.respcode IN ('5','8') AND rev.refnum IS NULL AND (` + offusRoutingExpr() + `)))`
}

// approvedThenReversedExpr: would have been approved but has a matching reversal.
func approvedThenReversedExpr() string {
	return `((t.respcode IN (` + approvedRespCodes + `) AND rev.refnum IS NOT NULL)` +
		` OR (t.respcode IN ('5','8') AND rev.refnum IS NOT NULL AND (` + offusRoutingExpr() + `)))`
}

// ---------------------------------------------------------------------------
// Reversals CTE (shared by report, trend, and detail list)
// MATERIALIZE + USE_HASH: without this Oracle often picks a nested-loop plan
// for small POS filters (~70s) even though ATM/switch hash-join in ~1s.
// endPadDays: report/trend use 2; detail list uses 1 (preserve existing windows).
// ---------------------------------------------------------------------------

func reversalsCTE(endPadDays int) string {
	var b strings.Builder
	b.WriteString(`WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + `)
	b.WriteString(strconv.Itoa(endPadDays))
	b.WriteString(`
)`)
	return b.String()
}

// ---------------------------------------------------------------------------
// Query assembly
// ---------------------------------------------------------------------------

func successTransactionQuery(msgTypeFilter, merchantTypeFilter, routingFilter string) string {
	approved := trulyApprovedExpr()
	reversed := approvedThenReversedExpr()
	offus := offusRoutingExpr()

	var b strings.Builder
	b.WriteString(reversalsCTE(2))
	b.WriteString("\n")
	// Hash-join hint pairs with MATERIALIZE on rev.
	b.WriteString(`SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN `)
	b.WriteString(approved)
	b.WriteString(` THEN 1 END) AS number_of_approved_txn,
	COUNT(CASE WHEN t.respcode = '4' THEN 1 END) AS do_not_honor,
	COUNT(CASE WHEN t.respcode = '5' AND NOT (`)
	b.WriteString(offus)
	b.WriteString(`) THEN 1 END) AS unable_to_process,
	COUNT(CASE WHEN t.respcode = '8' AND NOT (`)
	b.WriteString(offus)
	b.WriteString(`) THEN 1 END) AS issuer_timeout_8,
	COUNT(CASE WHEN t.respcode = '9' THEN 1 END) AS issuer_timeout_9,
	COUNT(CASE WHEN t.respcode = '10' THEN 1 END) AS unable_to_reverse,
	COUNT(CASE WHEN t.respcode = '14' THEN 1 END) AS invalid_card,
	COUNT(CASE WHEN t.respcode = '19' THEN 1 END) AS system_error_reenter,
	COUNT(CASE WHEN t.respcode = '20' THEN 1 END) AS no_from_account,
	COUNT(CASE WHEN t.respcode = '22' THEN 1 END) AS no_checking_account,
	COUNT(CASE WHEN t.respcode = '23' THEN 1 END) AS no_saving_account,
	COUNT(CASE WHEN t.respcode = '30' THEN 1 END) AS format_error,
	COUNT(CASE WHEN t.respcode = '48' THEN 1 END) AS chip_arqc_failure,
	COUNT(CASE WHEN t.respcode = '56' THEN 1 END) AS no_card_record,
	COUNT(CASE WHEN t.respcode = '57' THEN 1 END) AS txn_not_permitted_on_card,
	COUNT(CASE WHEN t.respcode = '58' THEN 1 END) AS txn_not_permitted_on_terminal,
	COUNT(CASE WHEN t.respcode = '68' THEN 1 END) AS late_response,
	COUNT(CASE WHEN t.respcode = '81' THEN 1 END) AS invalid_pin_block,
	COUNT(CASE WHEN t.respcode = '82' THEN 1 END) AS invalid_cvv,
	COUNT(CASE WHEN t.respcode = '87' THEN 1 END) AS pin_key_error,
	COUNT(CASE WHEN t.respcode = '91' THEN 1 END) AS switch_not_available,
	COUNT(CASE WHEN t.respcode = '92' THEN 1 END) AS invalid_issuer,
	COUNT(CASE WHEN t.respcode = '93' THEN 1 END) AS invalid_acquirer,
	COUNT(CASE WHEN t.respcode = '96' THEN 1 END) AS system_error,
	COUNT(CASE WHEN t.respcode = '99' THEN 1 END) AS duplicate_transaction,
	COUNT(CASE WHEN t.respcode = '102' THEN 1 END) AS partial_dispense,
	COUNT(CASE WHEN t.respcode = '103' THEN 1 END) AS unable_to_dispense,
	COUNT(CASE WHEN t.respcode = '112' THEN 1 END) AS uncertain_dispense,
	COUNT(CASE WHEN t.respcode = '113' THEN 1 END) AS deposit_error_113,
	COUNT(CASE WHEN t.respcode = '121' THEN 1 END) AS deposit_error_121,
	COUNT(CASE WHEN t.respcode = '702' THEN 1 END) AS server_declined,
	COUNT(CASE WHEN t.respcode = '801' THEN 1 END) AS clarification_two,
	COUNT(CASE WHEN t.respcode = '802' THEN 1 END) AS invalid_cvv_two,
	COUNT(CASE WHEN t.respcode = '900' THEN 1 END) AS issuer_down,
	COUNT(CASE WHEN t.respcode = '903' THEN 1 END) AS rejected_message,
	COUNT(CASE WHEN t.respcode = '906' THEN 1 END) AS transferee_down,
	COUNT(CASE WHEN t.respcode = '930' THEN 1 END) AS system_up,
	COUNT(CASE WHEN t.respcode = '990' THEN 1 END) AS system_error_990,
	COUNT(CASE WHEN t.respcode = '3' THEN 1 END) AS invalid_merchant,
	COUNT(CASE WHEN t.respcode = '39' THEN 1 END) AS no_credit_account,
	COUNT(CASE WHEN t.respcode = '811' THEN 1 END) AS system_security_error,
	COUNT(CASE WHEN t.respcode NOT IN (`)
	b.WriteString(classifiedRespCodes)
	b.WriteString(`) THEN 1 END) AS others,
	COUNT(CASE WHEN `)
	b.WriteString(reversed)
	b.WriteString(` THEN 1 END) AS reversed_after_approve,
	COUNT(*) - COUNT(CASE WHEN `)
	b.WriteString(approved)
	b.WriteString(` THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(
				COUNT(CASE WHEN `)
	b.WriteString(approved)
	b.WriteString(` THEN 1 END)
				/ NULLIF(COUNT(*), 0)
			) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (`)
	b.WriteString(approved)
	b.WriteString(`) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (`)
	b.WriteString(approved)
	b.WriteString(`) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE `)
	// Channel / flow / date clauses
	b.WriteString(msgTypeFilter)
	b.WriteString("\n\tAND ")
	b.WriteString(merchantTypeFilter)
	b.WriteString("\n\tAND ")
	b.WriteString(routingFilter)
	b.WriteString("\n\tAND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY')\n")
	return b.String()
}

func periodExprFor(granularity string) string {
	switch granularity {
	case "week":
		return `TRUNC(t.LOCAL_DATE, 'IW')`
	case "month":
		return `TRUNC(t.LOCAL_DATE, 'MM')`
	default:
		return `TRUNC(t.LOCAL_DATE)`
	}
}

func successTrendQuery(msgTypeFilter, merchantTypeFilter, routingFilter, periodExpr string) string {
	approved := trulyApprovedExpr()

	var b strings.Builder
	b.WriteString(reversalsCTE(2))
	b.WriteString("\n")
	b.WriteString(`SELECT /*+ USE_HASH(t rev) */
	TO_CHAR(`)
	b.WriteString(periodExpr)
	b.WriteString(`, 'YYYY-MM-DD') AS period_start,
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN `)
	b.WriteString(approved)
	b.WriteString(` THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN `)
	b.WriteString(approved)
	b.WriteString(` THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(
				COUNT(CASE WHEN `)
	b.WriteString(approved)
	b.WriteString(` THEN 1 END)
				/ NULLIF(COUNT(*), 0)
			) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (`)
	b.WriteString(approved)
	b.WriteString(`) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (`)
	b.WriteString(approved)
	b.WriteString(`) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE `)
	b.WriteString(msgTypeFilter)
	b.WriteString("\n\tAND ")
	b.WriteString(merchantTypeFilter)
	b.WriteString("\n\tAND ")
	b.WriteString(routingFilter)
	b.WriteString("\n\tAND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY')\nGROUP BY ")
	b.WriteString(periodExpr)
	b.WriteString("\nORDER BY ")
	b.WriteString(periodExpr)
	b.WriteString("\n")
	return b.String()
}

// terminalSuccessQuery returns per-terminal acquiring success-rate metrics.
// Acquiring = on-us + offus. Groups by TERMID so each row is one terminal.
// Channel scopes the msgtype/merchant-type filters, so pos and atm reuse this.
func terminalSuccessQuery(channel string) string {
	approved := trulyApprovedExpr()
	reversed := approvedThenReversedExpr()
	offus := offusRoutingExpr()
	msgType, merchantType, routing := channelFilters(channel, "acquiring")

	var b strings.Builder
	b.WriteString(reversalsCTE(2))
	b.WriteString("\n")
	b.WriteString(`SELECT /*+ USE_HASH(t rev) */
	TRIM(t.TERMID) AS terminal_id,
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN `)
	b.WriteString(approved)
	b.WriteString(` THEN 1 END) AS number_of_approved_txn,
	COUNT(CASE WHEN t.respcode = '4' THEN 1 END) AS do_not_honor,
	COUNT(CASE WHEN t.respcode = '5' AND NOT (`)
	b.WriteString(offus)
	b.WriteString(`) THEN 1 END) AS unable_to_process,
	COUNT(CASE WHEN t.respcode = '8' AND NOT (`)
	b.WriteString(offus)
	b.WriteString(`) THEN 1 END) AS issuer_timeout_8,
	COUNT(CASE WHEN t.respcode = '9' THEN 1 END) AS issuer_timeout_9,
	COUNT(CASE WHEN t.respcode = '10' THEN 1 END) AS unable_to_reverse,
	COUNT(CASE WHEN t.respcode = '14' THEN 1 END) AS invalid_card,
	COUNT(CASE WHEN t.respcode = '19' THEN 1 END) AS system_error_reenter,
	COUNT(CASE WHEN t.respcode = '20' THEN 1 END) AS no_from_account,
	COUNT(CASE WHEN t.respcode = '22' THEN 1 END) AS no_checking_account,
	COUNT(CASE WHEN t.respcode = '23' THEN 1 END) AS no_saving_account,
	COUNT(CASE WHEN t.respcode = '30' THEN 1 END) AS format_error,
	COUNT(CASE WHEN t.respcode = '48' THEN 1 END) AS chip_arqc_failure,
	COUNT(CASE WHEN t.respcode = '56' THEN 1 END) AS no_card_record,
	COUNT(CASE WHEN t.respcode = '57' THEN 1 END) AS txn_not_permitted_on_card,
	COUNT(CASE WHEN t.respcode = '58' THEN 1 END) AS txn_not_permitted_on_terminal,
	COUNT(CASE WHEN t.respcode = '68' THEN 1 END) AS late_response,
	COUNT(CASE WHEN t.respcode = '81' THEN 1 END) AS invalid_pin_block,
	COUNT(CASE WHEN t.respcode = '82' THEN 1 END) AS invalid_cvv,
	COUNT(CASE WHEN t.respcode = '87' THEN 1 END) AS pin_key_error,
	COUNT(CASE WHEN t.respcode = '91' THEN 1 END) AS switch_not_available,
	COUNT(CASE WHEN t.respcode = '92' THEN 1 END) AS invalid_issuer,
	COUNT(CASE WHEN t.respcode = '93' THEN 1 END) AS invalid_acquirer,
	COUNT(CASE WHEN t.respcode = '96' THEN 1 END) AS system_error,
	COUNT(CASE WHEN t.respcode = '99' THEN 1 END) AS duplicate_transaction,
	COUNT(CASE WHEN t.respcode = '102' THEN 1 END) AS partial_dispense,
	COUNT(CASE WHEN t.respcode = '103' THEN 1 END) AS unable_to_dispense,
	COUNT(CASE WHEN t.respcode = '112' THEN 1 END) AS uncertain_dispense,
	COUNT(CASE WHEN t.respcode = '113' THEN 1 END) AS deposit_error_113,
	COUNT(CASE WHEN t.respcode = '121' THEN 1 END) AS deposit_error_121,
	COUNT(CASE WHEN t.respcode = '702' THEN 1 END) AS server_declined,
	COUNT(CASE WHEN t.respcode = '801' THEN 1 END) AS clarification_two,
	COUNT(CASE WHEN t.respcode = '802' THEN 1 END) AS invalid_cvv_two,
	COUNT(CASE WHEN t.respcode = '900' THEN 1 END) AS issuer_down,
	COUNT(CASE WHEN t.respcode = '903' THEN 1 END) AS rejected_message,
	COUNT(CASE WHEN t.respcode = '906' THEN 1 END) AS transferee_down,
	COUNT(CASE WHEN t.respcode = '930' THEN 1 END) AS system_up,
	COUNT(CASE WHEN t.respcode = '990' THEN 1 END) AS system_error_990,
	COUNT(CASE WHEN t.respcode = '3' THEN 1 END) AS invalid_merchant,
	COUNT(CASE WHEN t.respcode = '39' THEN 1 END) AS no_credit_account,
	COUNT(CASE WHEN t.respcode = '811' THEN 1 END) AS system_security_error,
	COUNT(CASE WHEN t.respcode NOT IN (`)
	b.WriteString(classifiedRespCodes)
	b.WriteString(`) THEN 1 END) AS others,
	COUNT(CASE WHEN `)
	b.WriteString(reversed)
	b.WriteString(` THEN 1 END) AS reversed_after_approve,
	COUNT(*) - COUNT(CASE WHEN `)
	b.WriteString(approved)
	b.WriteString(` THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(
				COUNT(CASE WHEN `)
	b.WriteString(approved)
	b.WriteString(` THEN 1 END)
				/ NULLIF(COUNT(*), 0)
			) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (`)
	b.WriteString(approved)
	b.WriteString(`) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (`)
	b.WriteString(approved)
	b.WriteString(`) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE `)
	b.WriteString(msgType)
	b.WriteString("\n\tAND ")
	b.WriteString(merchantType)
	b.WriteString("\n\tAND ")
	b.WriteString(routing)
	b.WriteString("\n\tAND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY')\n")
	b.WriteString("GROUP BY t.TERMID\n")
	b.WriteString("ORDER BY COUNT(*) DESC\n")
	return b.String()
}

func listSuccessTransactionsQuery(
	channel, flow, outcomeFilter, respFilter string,
	limit int,
) string {
	approved := trulyApprovedExpr()
	reversed := approvedThenReversedExpr()
	msgType, merchantType, routing := channelFilters(channel, flow)

	var b strings.Builder
	// Detail list keeps the historical +1 pad on the reversals window.
	b.WriteString(reversalsCTE(1))
	b.WriteString("\n")
	b.WriteString(`SELECT /*+ USE_HASH(t rev) */
	TRIM(t.REFNUM) AS refnum,
	TO_CHAR(t.LOCAL_DATE, 'YYYY-MM-DD') AS txn_at,
	TO_CHAR(
	TO_DATE(LPAD(TO_CHAR(t.LOCAL_TIME), 6, '0'), 'HH24MISS'), 'HH24:MI:SS') AS txn_time,
	t.MSGTYPE AS msg_type,
	TRIM(t.TERMID) AS terminal_id,
	TRIM(t.TERMLOC) AS terminal_location,
	TRIM(t.CARDPRODUCT) AS card_product,
	TRIM(TO_CHAR(t.respcode)) AS resp_code,
	CASE
		WHEN `)
	b.WriteString(approved)
	b.WriteString(` THEN 'approved'
		WHEN `)
	b.WriteString(reversed)
	b.WriteString(` THEN 'reversed'
		ELSE 'declined'
	END AS outcome,
	CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END AS amount,
	TRIM(t.ACQUIRER) AS acquirer,
	TRIM(t.TXNSRC) AS txn_src,
	TRIM(t.TXNDEST) AS txn_dest,
	CASE WHEN t.MERCHANT_TYPE IS NULL THEN 0 ELSE t.MERCHANT_TYPE END AS merchant_type
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE `)
	b.WriteString(msgType)
	b.WriteString("\n\tAND ")
	b.WriteString(merchantType)
	b.WriteString("\n\tAND ")
	b.WriteString(routing)
	b.WriteString("\n\tAND ")
	b.WriteString(outcomeFilter)
	b.WriteString("\n\tAND ")
	b.WriteString(respFilter)
	b.WriteString("\n\tAND t.LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')")
	b.WriteString("\n\tAND t.LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1")
	b.WriteString("\nORDER BY t.LOCAL_DATE DESC, t.LOCAL_TIME DESC, t.REFNUM DESC")
	b.WriteString("\nFETCH FIRST ")
	b.WriteString(strconv.Itoa(limit))
	b.WriteString(" ROWS ONLY\n")
	return b.String()
}
