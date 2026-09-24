package oracle

import (
	"context"
	"database/sql"
	"strconv"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

const approvedRespCodes = `'0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904'`

const classifiedRespCodes = `'0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','4','5','8','9','10','14','19','20','22','23','30','48','56','57','58','68','81','82','87','91','92','93','96','99','102','103','112','113','121','702','801','802','900','903','906','930','990','3','39','811'`

// Routing filters (merchant type applied separately for atm/pos).
// ATM uses MSGTYPE 210 only. POS uses MSGTYPE 110 and 210.
// ATM on-us uses acquirer 1000000011 + Cortex.
// POS on-us uses Cortex + CoopBank BIN in TXNSRC (402032); POS issuing excludes that set.
const (
	coopPOSTxnSrcBIN = "402032"

	msgTypesATM = `t.MSGTYPE = 210`
	msgTypesPOS = `t.MSGTYPE IN (110, 210)`
	// Switch: ATM rows stay 210-only; POS rows allow 110 and 210.
	msgTypesSwitch = `((t.MERCHANT_TYPE = 6011 AND t.MSGTYPE = 210) OR (t.MERCHANT_TYPE <> 6011 AND t.MSGTYPE IN (110, 210)))`

	routingATMOnus      = `TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) = 'CBOBCORTEX'`
	routingATMOffus     = `TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')`
	routingATMIssuing   = `TRIM(t.ACQUIRER) = '1000000010' AND TRIM(t.TXNDEST) = 'CBOBCORTEX'`
	routingATMAcquiring = `TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('CBOBCORTEX', '8888888888', '04', '05')`
	routingATMOverall   = `((TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('CBOBCORTEX', '8888888888', '04', '05')) OR (TRIM(t.ACQUIRER) = '1000000010' AND TRIM(t.TXNDEST) = 'CBOBCORTEX'))`

	routingPOSOnus      = `TRIM(t.TXNDEST) = 'CBOBCORTEX' AND TRIM(t.TXNSRC) = '` + coopPOSTxnSrcBIN + `'`
	routingPOSOffus     = `TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')`
	routingPOSIssuing   = `TRIM(t.ACQUIRER) = '1000000010' AND TRIM(t.TXNDEST) = 'CBOBCORTEX' AND TRIM(t.TXNSRC) <> '` + coopPOSTxnSrcBIN + `'`
	routingPOSAcquiring = `((` + routingPOSOnus + `) OR (` + routingPOSOffus + `))`
	routingPOSOverall   = `((` + routingPOSOnus + `) OR (` + routingPOSOffus + `) OR (` + routingPOSIssuing + `))`
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

func routingFilterFor(channel, flow string) string {
	switch channel {
	case "pos":
		switch flow {
		case "onus":
			return routingPOSOnus
		case "offus":
			return routingPOSOffus
		case "issuing":
			return routingPOSIssuing
		case "acquiring":
			return routingPOSAcquiring
		case "overall":
			return routingPOSOverall
		default:
			return routingPOSAcquiring
		}
	case "switch":
		// ATM rule OR POS rule, scoped by merchant type so channels do not bleed.
		atm := routingFilterFor("atm", flow)
		pos := routingFilterFor("pos", flow)
		return `((t.MERCHANT_TYPE = 6011 AND (` + atm + `)) OR (t.MERCHANT_TYPE <> 6011 AND (` + pos + `)))`
	default: // atm
		switch flow {
		case "onus":
			return routingATMOnus
		case "offus":
			return routingATMOffus
		case "issuing":
			return routingATMIssuing
		case "acquiring":
			return routingATMAcquiring
		case "overall":
			return routingATMOverall
		default:
			return routingATMAcquiring
		}
	}
}

// Success requires an approved respcode and no matching 410/420/430 on the same REFNUM.
const trulyApprovedExpr = `t.respcode IN (` + approvedRespCodes + `) AND rev.refnum IS NULL`

const approvedThenReversedExpr = `t.respcode IN (` + approvedRespCodes + `) AND rev.refnum IS NOT NULL`

func successTransactionQuery(msgTypeFilter, merchantTypeFilter, routingFilter string) string {
	// Materialize the reversal REFNUM set and force a hash join. Without this, Oracle
	// often picks a nested-loop plan for small POS filters (~70s) even though ATM/switch
	// hash-join the same pattern in ~1s.
	return `
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN ` + trulyApprovedExpr + ` THEN 1 END) AS number_of_approved_txn,
	COUNT(CASE WHEN t.respcode = '4' THEN 1 END) AS do_not_honor,
	COUNT(CASE WHEN t.respcode = '5' THEN 1 END) AS unable_to_process,
	COUNT(CASE WHEN t.respcode = '8' THEN 1 END) AS issuer_timeout_8,
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
	COUNT(CASE WHEN t.respcode NOT IN (` + classifiedRespCodes + `) THEN 1 END) AS others,
	COUNT(CASE WHEN ` + approvedThenReversedExpr + ` THEN 1 END) AS reversed_after_approve,
	COUNT(*) - COUNT(CASE WHEN ` + trulyApprovedExpr + ` THEN 1 END) AS number_of_declined_txn,
	NVL(
		ROUND(
			(
				COUNT(CASE WHEN ` + trulyApprovedExpr + ` THEN 1 END)
				/ NULLIF(COUNT(*), 0)
			) * 100,
			2
		),
		0
	) AS percent_success_rate,
	NVL(SUM(CASE WHEN ` + trulyApprovedExpr + ` THEN t.amount ELSE 0 END), 0) AS total_approved_amount,
	NVL(SUM(t.amount), 0) - NVL(SUM(CASE WHEN ` + trulyApprovedExpr + ` THEN t.amount ELSE 0 END), 0) AS total_declined_amount,
	NVL(SUM(t.amount), 0) AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE ` + msgTypeFilter + `
	AND ` + merchantTypeFilter + `
	AND ` + routingFilter + `
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY')
`
}

type successTransactionRepository struct {
	db *sql.DB
}

func NewSuccessTransactionRepository(db *sql.DB) repository.SuccessTransactionRepository {
	return &successTransactionRepository{
		db: db,
	}
}

type successTransactionRow struct {
	TotalTransactions   sql.NullFloat64
	ApprovedCount       sql.NullFloat64
	DoNotHonor          sql.NullFloat64
	UnableToProcess     sql.NullFloat64
	IssuerTimeout8      sql.NullFloat64
	IssuerTimeout9      sql.NullFloat64
	UnableToReverse     sql.NullFloat64
	InvalidCard         sql.NullFloat64
	SystemErrorReenter  sql.NullFloat64
	NoFromAccount       sql.NullFloat64
	NoCheckingAccount   sql.NullFloat64
	NoSavingAccount     sql.NullFloat64
	FormatError         sql.NullFloat64
	ChipArqcFailure     sql.NullFloat64
	NoCardRecord        sql.NullFloat64
	NotPermittedOnCard  sql.NullFloat64
	NotPermittedOnTerm  sql.NullFloat64
	LateResponse        sql.NullFloat64
	InvalidPINBlock     sql.NullFloat64
	InvalidCVV          sql.NullFloat64
	PINKeyError         sql.NullFloat64
	SwitchNotAvailable  sql.NullFloat64
	InvalidIssuer       sql.NullFloat64
	InvalidAcquirer     sql.NullFloat64
	SystemError         sql.NullFloat64
	DuplicateTxn        sql.NullFloat64
	PartialDispense     sql.NullFloat64
	UnableToDispense    sql.NullFloat64
	UncertainDispense   sql.NullFloat64
	DepositError113     sql.NullFloat64
	DepositError121     sql.NullFloat64
	ServerDeclined      sql.NullFloat64
	ClarificationTwo    sql.NullFloat64
	InvalidCVVTwo       sql.NullFloat64
	IssuerDown          sql.NullFloat64
	RejectedMessage     sql.NullFloat64
	TransfereeDown      sql.NullFloat64
	SystemUp            sql.NullFloat64
	SystemError990      sql.NullFloat64
	InvalidMerchant     sql.NullFloat64
	NoCreditAccount     sql.NullFloat64
	SystemSecurityError sql.NullFloat64
	Others              sql.NullFloat64
	Reversed            sql.NullFloat64
	DeclinedCount       sql.NullFloat64
	SuccessRatePercent  sql.NullFloat64
	ApprovedAmount      sql.NullFloat64
	DeclinedAmount      sql.NullFloat64
	TotalAmount         sql.NullFloat64
}

func (r *successTransactionRepository) GetReport(ctx context.Context, dateFrom, dateTo, channel, flow string) (*model.SuccessTransactionReport, error) {
	merchantTypeFilter := merchantTypeFilterFor(channel)
	routingFilter := routingFilterFor(channel, flow)
	msgTypeFilter := msgTypeFilterFor(channel)

	metric, err := r.queryFlow(ctx, dateFrom, dateTo, msgTypeFilter, merchantTypeFilter, routingFilter)
	if err != nil {
		return nil, err
	}

	return &model.SuccessTransactionReport{
		DateFrom:           dateFrom,
		DateTo:             dateTo,
		Channel:            channel,
		Flow:               flow,
		TotalTransactions:  metric.TotalTransactions,
		ApprovedCount:      metric.ApprovedCount,
		DeclinedCount:      metric.DeclinedCount,
		SuccessRatePercent: metric.SuccessRatePercent,
		ApprovedAmount:     metric.ApprovedAmount,
		DeclinedAmount:     metric.DeclinedAmount,
		TotalAmount:        metric.TotalAmount,
		DeclineReasons:     metric.DeclineReasons,
	}, nil
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
	return `
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	TO_CHAR(` + periodExpr + `, 'YYYY-MM-DD') AS period_start,
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN ` + trulyApprovedExpr + ` THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN ` + trulyApprovedExpr + ` THEN 1 END) AS number_of_declined_txn,
	NVL(
		ROUND(
			(
				COUNT(CASE WHEN ` + trulyApprovedExpr + ` THEN 1 END)
				/ NULLIF(COUNT(*), 0)
			) * 100,
			2
		),
		0
	) AS percent_success_rate,
	NVL(SUM(CASE WHEN ` + trulyApprovedExpr + ` THEN t.amount ELSE 0 END), 0) AS total_approved_amount,
	NVL(SUM(t.amount), 0) - NVL(SUM(CASE WHEN ` + trulyApprovedExpr + ` THEN t.amount ELSE 0 END), 0) AS total_declined_amount,
	NVL(SUM(t.amount), 0) AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE ` + msgTypeFilter + `
	AND ` + merchantTypeFilter + `
	AND ` + routingFilter + `
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY')
GROUP BY ` + periodExpr + `
ORDER BY ` + periodExpr + `
`
}

func trendPeriodLabel(periodStart, granularity string) string {
	parsed, err := time.Parse("2006-01-02", periodStart)
	if err != nil {
		return periodStart
	}
	switch granularity {
	case "week":
		end := parsed.AddDate(0, 0, 6)
		return parsed.Format("Jan 2") + " – " + end.Format("Jan 2")
	case "month":
		return parsed.Format("Jan 2006")
	default:
		return parsed.Format("Jan 2")
	}
}

func (r *successTransactionRepository) GetTrend(
	ctx context.Context,
	dateFrom, dateTo, channel, flow, granularity string,
) (*model.SuccessRateTrendReport, error) {
	periodExpr := periodExprFor(granularity)
	query := successTrendQuery(
		msgTypeFilterFor(channel),
		merchantTypeFilterFor(channel),
		routingFilterFor(channel, flow),
		periodExpr,
	)

	rows, err := r.db.QueryContext(
		ctx,
		query,
		sql.Named("date_from", dateFrom),
		sql.Named("date_to", dateTo),
	)
	if err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	points := make([]model.SuccessRateTrendPoint, 0)
	for rows.Next() {
		var (
			periodStart                                       string
			total, approved, declined                         sql.NullFloat64
			rate, approvedAmount, declinedAmount, totalAmount sql.NullFloat64
		)
		if err := rows.Scan(
			&periodStart,
			&total,
			&approved,
			&declined,
			&rate,
			&approvedAmount,
			&declinedAmount,
			&totalAmount,
		); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}

		points = append(points, model.SuccessRateTrendPoint{
			PeriodStart:        periodStart,
			PeriodLabel:        trendPeriodLabel(periodStart, granularity),
			TotalTransactions:  int64(nullFloat(total)),
			ApprovedCount:      int64(nullFloat(approved)),
			DeclinedCount:      int64(nullFloat(declined)),
			SuccessRatePercent: nullFloat(rate),
			ApprovedAmount:     nullFloat(approvedAmount),
			DeclinedAmount:     nullFloat(declinedAmount),
			TotalAmount:        nullFloat(totalAmount),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}

	return &model.SuccessRateTrendReport{
		DateFrom:    dateFrom,
		DateTo:      dateTo,
		Channel:     channel,
		Flow:        flow,
		Granularity: granularity,
		Points:      points,
	}, nil
}

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

func (r *successTransactionRepository) ListTransactions(
	ctx context.Context,
	dateFrom, dateTo, channel, flow, outcome, respCode string,
	limit int,
) ([]model.SuccessTransactionDetail, error) {
	if limit <= 0 {
		limit = 250
	}
	if limit > 500 {
		limit = 500
	}

	outcomeFilter := "1=1"
	switch outcome {
	case "", "all":
		outcomeFilter = "1=1"
	case "approved":
		outcomeFilter = trulyApprovedExpr
	case "declined":
		outcomeFilter = `NOT (` + trulyApprovedExpr + `)`
	}

	respFilter := "1=1"
	switch respCode {
	case "":
		respFilter = "1=1"
	case "reversed":
		respFilter = approvedThenReversedExpr
	case "other":
		respFilter = `t.respcode NOT IN (` + classifiedRespCodes + `)`
	default:
		respFilter = `TRIM(TO_CHAR(t.respcode)) = :resp_code`
	}

	query := `
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1
)
SELECT /*+ USE_HASH(t rev) */
	NVL(TRIM(t.REFNUM), '') AS refnum,
	TO_CHAR(t.LOCAL_DATE, 'YYYY-MM-DD') AS txn_at,
	TO_CHAR(
	TO_DATE(LPAD(TO_CHAR(t.LOCAL_TIME), 6, '0'), 'HH24MISS'), 'HH24:MI:SS') AS txn_time,
	t.MSGTYPE AS msg_type,
	NVL(TRIM(t.TERMID), '') AS terminal_id,
	NVL(TRIM(t.TERMLOC), '') AS terminal_location,
	NVL(TRIM(t.CARDPRODUCT), '') AS card_product,
	NVL(TRIM(TO_CHAR(t.respcode)), '') AS resp_code,
	CASE
		WHEN ` + trulyApprovedExpr + ` THEN 'approved'
		WHEN ` + approvedThenReversedExpr + ` THEN 'reversed'
		ELSE 'declined'
	END AS outcome,
	NVL(t.amount, 0) AS amount,
	NVL(TRIM(t.ACQUIRER), '') AS acquirer,
	NVL(TRIM(t.TXNSRC), '') AS txn_src,
	NVL(TRIM(t.TXNDEST), '') AS txn_dest,
	NVL(t.MERCHANT_TYPE, 0) AS merchant_type
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE ` + msgTypeFilterFor(channel) + `
	AND ` + merchantTypeFilterFor(channel) + `
	AND ` + routingFilterFor(channel, flow) + `
	AND ` + outcomeFilter + `
	AND ` + respFilter + `
	AND t.LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
	AND t.LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1
ORDER BY t.LOCAL_DATE DESC, t.LOCAL_TIME DESC, t.REFNUM DESC
FETCH FIRST ` + strconv.Itoa(limit) + ` ROWS ONLY
`

	args := []any{
		sql.Named("date_from", dateFrom),
		sql.Named("date_to", dateTo),
	}
	if respCode != "" && respCode != "reversed" && respCode != "other" {
		args = append(args, sql.Named("resp_code", respCode))
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	out := make([]model.SuccessTransactionDetail, 0, limit)
	for rows.Next() {
		var (
			refNum, txnAt, txnTime, termID, termLoc, product, resp, outcomeVal string
			acquirer, txnSrc, txnDest                                          string
			msgType, merchantType                                              sql.NullFloat64
			amount                                                             sql.NullFloat64
		)
		if err := rows.Scan(
			&refNum,
			&txnAt,
			&txnTime,
			&msgType,
			&termID,
			&termLoc,
			&product,
			&resp,
			&outcomeVal,
			&amount,
			&acquirer,
			&txnSrc,
			&txnDest,
			&merchantType,
		); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}

		id := refNum
		if id == "" {
			id = txnAt + "|" + termID + "|" + resp
		}

		out = append(out, model.SuccessTransactionDetail{
			ID:               id,
			TxnAt:            txnAt,
			TxnTime:          txnTime,
			MsgType:          nullInt(msgType),
			TerminalID:       termID,
			TerminalLocation: termLoc,
			CardMasked:       "",
			CardProduct:      product,
			RespCode:         resp,
			RespLabel:        respCodeLabel(resp, outcomeVal),
			Outcome:          outcomeVal,
			Amount:           nullFloat(amount),
			RefNum:           refNum,
			Acquirer:         acquirer,
			TxnSrc:           txnSrc,
			TxnDest:          txnDest,
			MerchantType:     nullInt(merchantType),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	return out, nil
}

func respCodeLabel(code, outcome string) string {
	if outcome == "reversed" || code == "reversed" {
		return "Reversed after approve"
	}
	labels := map[string]string{
		"0": "Approved", "2": "Approved", "11": "Approved", "12": "Approved", "13": "Approved",
		"17": "Approved", "41": "Approved", "42": "Approved", "43": "Approved", "44": "Approved",
		"46": "Approved", "51": "Approved", "54": "Approved", "55": "Approved", "59": "Approved",
		"61": "Approved", "62": "Approved", "65": "Approved", "67": "Approved", "75": "Approved",
		"76": "Approved", "80": "Approved", "89": "Approved", "98": "Approved", "115": "Approved",
		"251": "Approved", "252": "Approved", "503": "Approved", "902": "Approved", "904": "Approved",
		"4": "Do not honor", "5": "Unable to process", "8": "Issuer timeout", "9": "Issuer timeout",
		"10": "Unable to reverse", "14": "Invalid Card", "19": "System Error Reenter",
		"20": "No from account", "22": "No checking account", "23": "No Saving Account",
		"30": "Format Error", "48": "Chip Arqc Failure", "56": "No card record",
		"57": "Transaction not permitted on card", "58": "Transaction not permitted on terminal",
		"68": "Late Response", "81": "Invalid PIN Block", "82": "Invalid CVV", "87": "PIN key error",
		"91": "Switch not available", "92": "Invalid Issuer", "93": "Invalid Acquirer",
		"96": "System Error", "99": "Duplicate Transaction", "102": "Partial Dispense",
		"103": "Unable to dispense", "112": "Uncertain Dispense", "113": "Deposit Error",
		"121": "Deposit Error", "702": "Server Declined", "801": "Clarification-Two",
		"802": "Invalid CVV-Two", "900": "Issuer Down", "903": "Rejected Message",
		"906": "TransfereeDown", "930": "System Up", "990": "system error",
		"3": "Invalid Merchant", "39": "No credit Account", "811": "System Security/system error",
	}
	if label, ok := labels[code]; ok {
		return label
	}
	if code == "" {
		return "Unknown"
	}
	return "Others"
}

type flowMetricResult struct {
	TotalTransactions  int64
	ApprovedCount      int64
	DeclinedCount      int64
	SuccessRatePercent float64
	ApprovedAmount     float64
	DeclinedAmount     float64
	TotalAmount        float64
	DeclineReasons     []model.DeclineReason
}

func (r *successTransactionRepository) queryFlow(
	ctx context.Context,
	dateFrom, dateTo, msgTypeFilter, merchantTypeFilter, routingFilter string,
) (flowMetricResult, error) {
	var row successTransactionRow

	err := r.db.QueryRowContext(
		ctx,
		successTransactionQuery(msgTypeFilter, merchantTypeFilter, routingFilter),
		sql.Named("date_from", dateFrom),
		sql.Named("date_to", dateTo),
	).Scan(
		&row.TotalTransactions,
		&row.ApprovedCount,
		&row.DoNotHonor,
		&row.UnableToProcess,
		&row.IssuerTimeout8,
		&row.IssuerTimeout9,
		&row.UnableToReverse,
		&row.InvalidCard,
		&row.SystemErrorReenter,
		&row.NoFromAccount,
		&row.NoCheckingAccount,
		&row.NoSavingAccount,
		&row.FormatError,
		&row.ChipArqcFailure,
		&row.NoCardRecord,
		&row.NotPermittedOnCard,
		&row.NotPermittedOnTerm,
		&row.LateResponse,
		&row.InvalidPINBlock,
		&row.InvalidCVV,
		&row.PINKeyError,
		&row.SwitchNotAvailable,
		&row.InvalidIssuer,
		&row.InvalidAcquirer,
		&row.SystemError,
		&row.DuplicateTxn,
		&row.PartialDispense,
		&row.UnableToDispense,
		&row.UncertainDispense,
		&row.DepositError113,
		&row.DepositError121,
		&row.ServerDeclined,
		&row.ClarificationTwo,
		&row.InvalidCVVTwo,
		&row.IssuerDown,
		&row.RejectedMessage,
		&row.TransfereeDown,
		&row.SystemUp,
		&row.SystemError990,
		&row.InvalidMerchant,
		&row.NoCreditAccount,
		&row.SystemSecurityError,
		&row.Others,
		&row.Reversed,
		&row.DeclinedCount,
		&row.SuccessRatePercent,
		&row.ApprovedAmount,
		&row.DeclinedAmount,
		&row.TotalAmount,
	)
	if err != nil {
		return flowMetricResult{}, wrapError(common.ErrFailedToFetchReport, err)
	}

	return mapFlowMetric(row), nil
}

func mapFlowMetric(row successTransactionRow) flowMetricResult {
	return flowMetricResult{
		TotalTransactions:  nullInt(row.TotalTransactions),
		ApprovedCount:      nullInt(row.ApprovedCount),
		DeclinedCount:      nullInt(row.DeclinedCount),
		SuccessRatePercent: nullFloat(row.SuccessRatePercent),
		ApprovedAmount:     nullFloat(row.ApprovedAmount),
		DeclinedAmount:     nullFloat(row.DeclinedAmount),
		TotalAmount:        nullFloat(row.TotalAmount),
		DeclineReasons: []model.DeclineReason{
			reason("4", "Do not honor", row.DoNotHonor),
			reason("5", "Unable to process", row.UnableToProcess),
			reason("8", "Issuer timeout", row.IssuerTimeout8),
			reason("9", "Issuer timeout", row.IssuerTimeout9),
			reason("10", "Unable to reverse", row.UnableToReverse),
			reason("14", "Invalid Card", row.InvalidCard),
			reason("19", "System Error Reenter", row.SystemErrorReenter),
			reason("20", "No from account", row.NoFromAccount),
			reason("22", "No checking account", row.NoCheckingAccount),
			reason("23", "No Saving Account", row.NoSavingAccount),
			reason("30", "Format Error", row.FormatError),
			reason("48", "Chip Arqc Failure", row.ChipArqcFailure),
			reason("56", "No card record", row.NoCardRecord),
			reason("57", "Transaction not permitted on card", row.NotPermittedOnCard),
			reason("58", "Transaction not permitted on terminal", row.NotPermittedOnTerm),
			reason("68", "Late Response", row.LateResponse),
			reason("81", "Invalid PIN Block", row.InvalidPINBlock),
			reason("82", "Invalid CVV", row.InvalidCVV),
			reason("87", "PIN key error", row.PINKeyError),
			reason("91", "Switch not available", row.SwitchNotAvailable),
			reason("92", "Invalid Issuer", row.InvalidIssuer),
			reason("93", "Invalid Acquirer", row.InvalidAcquirer),
			reason("96", "System Error", row.SystemError),
			reason("99", "Duplicate Transaction", row.DuplicateTxn),
			reason("102", "Partial Dispense", row.PartialDispense),
			reason("103", "Unable to dispense", row.UnableToDispense),
			reason("112", "Uncertain Dispense", row.UncertainDispense),
			reason("113", "Deposit Error", row.DepositError113),
			reason("121", "Deposit Error", row.DepositError121),
			reason("702", "Server Declined", row.ServerDeclined),
			reason("801", "Clarification-Two", row.ClarificationTwo),
			reason("802", "Invalid CVV-Two", row.InvalidCVVTwo),
			reason("900", "Issuer Down", row.IssuerDown),
			reason("903", "Rejected Message", row.RejectedMessage),
			reason("906", "TransfereeDown", row.TransfereeDown),
			reason("930", "System Up", row.SystemUp),
			reason("990", "system error", row.SystemError990),
			reason("3", "Invalid Merchant", row.InvalidMerchant),
			reason("39", "No credit Account", row.NoCreditAccount),
			reason("811", "System Security/system error", row.SystemSecurityError),
			reason("reversed", "Reversed after approve", row.Reversed),
			reason("other", "Others", row.Others),
		},
	}
}

func nullInt(value sql.NullFloat64) int64 {
	if !value.Valid {
		return 0
	}

	return int64(value.Float64)
}

func nullFloat(value sql.NullFloat64) float64 {
	if !value.Valid {
		return 0
	}

	return value.Float64
}

func reason(code, label string, value sql.NullFloat64) model.DeclineReason {
	return model.DeclineReason{
		Code:  code,
		Label: label,
		Count: nullInt(value),
	}
}
