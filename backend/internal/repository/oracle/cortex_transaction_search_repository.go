package oracle

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"unicode"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

const (
	cortexTxnSignedAmtBill = `CASE WHEN t.MSGCLS IN (4, 410, 420, 430) THEN -NVL(t.AMTBILL, 0) ELSE NVL(t.AMTBILL, 0) END`
	cortexTxnSignedAmtTxn  = `CASE WHEN t.MSGCLS IN (4, 410, 420, 430) THEN -NVL(t.AMTTXN, 0) ELSE NVL(t.AMTTXN, 0) END`
)

type cortexTransactionSearchRepository struct {
	db *sql.DB
}

func NewCortexTransactionSearchRepository(db *sql.DB) repository.CortexTransactionSearchRepository {
	return &cortexTransactionSearchRepository{db: db}
}

func (r *cortexTransactionSearchRepository) Search(
	ctx context.Context,
	req model.CortexTransactionSearchRequest,
	includeCardholder bool,
	page, pageSize int,
) (*model.CortexTransactionSearchResult, error) {
	page, pageSize = normalizePrepaidVisaPage(page, pageSize)
	offset := (page - 1) * pageSize
	fetchLimit := pageSize + 1

	cardholder := prepaidVisaCardholderNull
	if includeCardholder {
		cardholder = prepaidVisaCardholderPermitted
	}

	var dateSQL string
	var dateArgs []any
	// Exact log id is unique; do not apply the soft 24-month cap.
	if req.TlogID != nil && *req.TlogID > 0 &&
		strings.TrimSpace(req.DateFrom) == "" &&
		strings.TrimSpace(req.DateTo) == "" {
		dateSQL, dateArgs = "", nil
	} else {
		dateSQL, dateArgs = prepaidVisaLedgerDateClause("t", req.DateFrom, req.DateTo)
	}
	filterSQL, filterArgs := cortexTxnSearchFilterClause(req, includeCardholder)
	productSQL := cortexTxnProductPred(req.Product)

	q := fmt.Sprintf(`
		SELECT
			c.ID AS CARD_ID,
			SUBSTR(c.PAN_DISPLAY, 1, 6) || 'XXXXXX' || SUBSTR(c.PAN_DISPLAY, -4) AS CARD_MASKED,
			%s
			NVL(SUBSTR(TRIM(t.CRDPRODUCT), 1, 3), TO_CHAR(c.CRDPRODUCT_ID)) AS PRODUCT_CODE,
			NVL(TRIM(p.DESCR), 'Card product') AS PRODUCT_NAME,
			TRIM(c.STATCODE) AS STATUS_CODE,
			TRIM(s.DESCR) AS STATUS_DESCRIPTION,
			TRIM(b.BRNCODE) AS BRANCH_CODE,
			TRIM(b.DESCR) AS BRANCH_NAME,
			%s AS AMOUNT,
			TRIM(TO_CHAR(t.CURBILL)) AS CURRENCY,
			%s AS AMOUNT_TXN,
			TRIM(TO_CHAR(t.CURTXN)) AS TXN_CURRENCY,
			TO_CHAR(t.TXNCODE) AS TXN_CODE,
			TRIM(TO_CHAR(t.MSGCLS)) AS MSG_TYPE,
			TRIM(t.RSPCODE) AS RSP_CODE,
			TRIM(t.RRN) AS RRN,
			TRIM(t.TERMCODE) AS TERMINAL_ID,
			TRIM(t.CRDACPTLOC) AS MERCHANT_NAME,
			TRIM(t.CRDACPTID) AS MERCHANT_ID,
			TO_CHAR(t.CTXDATE, 'YYYY-MM-DD') AS TXN_DATE,
			CASE
				WHEN t.TIMELOCAL IS NULL THEN ''
				ELSE SUBSTR(LPAD(TO_CHAR(t.TIMELOCAL), 6, '0'), 1, 2)
					|| ':' || SUBSTR(LPAD(TO_CHAR(t.TIMELOCAL), 6, '0'), 3, 2)
					|| ':' || SUBSTR(LPAD(TO_CHAR(t.TIMELOCAL), 6, '0'), 5, 2)
			END AS TXN_TIME,
			t.ID AS TLOG_ID
		FROM cortex.tlog t
		JOIN cortex.crddet c ON c.ID = t.CRDDET_ID
		LEFT JOIN cortex.crdproduct p ON p.ID = c.CRDPRODUCT_ID
		LEFT JOIN cortex.crdstatus s ON TRIM(c.STATCODE) = TRIM(s.STATCODE)
		LEFT JOIN cortex.branch b ON b.ID = c.BRANCH_ID
		WHERE 1=1
			%s
			%s
			%s
		ORDER BY t.CTXDATE DESC, t.ID DESC
		OFFSET :offset ROWS
		FETCH NEXT :fetch_limit ROWS ONLY
	`,
		cardholder,
		cortexTxnSignedAmtBill,
		cortexTxnSignedAmtTxn,
		dateSQL,
		productSQL,
		filterSQL,
	)

	args := append([]any{}, dateArgs...)
	args = append(args, filterArgs...)
	args = append(args,
		sql.Named("offset", offset),
		sql.Named("fetch_limit", fetchLimit),
	)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	items := make([]model.CortexTransaction, 0, fetchLimit)
	for rows.Next() {
		var (
			cardID                                         sql.NullInt64
			cardMasked, holder, productCode, productName   sql.NullString
			statusCode, statusDesc, branchCode, branchName sql.NullString
			amount, amountTxn                              sql.NullFloat64
			currency, txnCurrency                          sql.NullString
			txnCode, msgType, rspCode                      sql.NullString
			rrn, termID, merchant, merchantID              sql.NullString
			date, time                                     sql.NullString
			tlogID                                         sql.NullInt64
		)
		if err := rows.Scan(
			&cardID, &cardMasked, &holder,
			&productCode, &productName,
			&statusCode, &statusDesc,
			&branchCode, &branchName,
			&amount, &currency, &amountTxn, &txnCurrency,
			&txnCode, &msgType, &rspCode,
			&rrn, &termID, &merchant, &merchantID,
			&date, &time, &tlogID,
		); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}
		items = append(items, model.CortexTransaction{
			CardID:            cardID.Int64,
			CardMasked:        cardMasked.String,
			CardholderName:    holder.String,
			ProductCode:       productCode.String,
			ProductName:       productName.String,
			StatusCode:        statusCode.String,
			StatusDescription: statusDesc.String,
			BranchCode:        branchCode.String,
			BranchName:        branchName.String,
			Amount:            amount.Float64,
			Currency:          currency.String,
			AmountTxn:         amountTxn.Float64,
			TxnCurrency:       txnCurrency.String,
			TxnCode:           txnCode.String,
			MsgType:           msgType.String,
			RspCode:           rspCode.String,
			Approved:          rspCode.String == "00",
			RRN:               rrn.String,
			TerminalID:        termID.String,
			MerchantName:      merchant.String,
			MerchantID:        merchantID.String,
			Date:              date.String,
			Time:              time.String,
			TlogID:            tlogID.Int64,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}

	pageRows, hasMore := trimPrepaidVisaPage(items, pageSize)
	return &model.CortexTransactionSearchResult{
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
		Items:    pageRows,
	}, nil
}

func cortexTxnProductPred(product string) string {
	p := cortexTxnSanitizeProduct(product)
	if p == "" {
		return ""
	}
	// Bound literal is sanitized to digits only.
	return fmt.Sprintf(" AND t.CRDPRODUCT LIKE '%s%%'", p)
}

func cortexTxnSanitizeProduct(raw string) string {
	return cortexTxnSanitizeDigits(raw, 8)
}

func cortexTxnSanitizeDigits(raw string, maxLen int) string {
	if maxLen < 1 {
		maxLen = 8
	}
	var b strings.Builder
	for _, r := range strings.TrimSpace(raw) {
		if unicode.IsDigit(r) {
			b.WriteRune(r)
		}
		if b.Len() >= maxLen {
			break
		}
	}
	return b.String()
}

func cortexTxnSearchFilterClause(req model.CortexTransactionSearchRequest, includeCardholder bool) (string, []any) {
	var parts []string
	var args []any

	card := prepaidVisaSanitizeSearch(req.Card)
	if card != "" {
		cardUp := strings.ToUpper(card)
		parts = append(parts, `(
			UPPER(TRIM(NVL(c.PAN_DISPLAY, ' '))) LIKE :card_like
			OR SUBSTR(TRIM(c.PAN_DISPLAY), -4) = :card_exact
		)`)
		args = append(args,
			sql.Named("card_like", "%"+cardUp+"%"),
			sql.Named("card_exact", cardUp),
		)
	}

	branch := strings.ToUpper(prepaidVisaSanitizeSearch(req.Branch))
	if branch != "" {
		parts = append(parts, `(
			UPPER(TRIM(NVL(b.BRNCODE, ' '))) LIKE :branch_like
			OR UPPER(TRIM(NVL(b.DESCR, ' '))) LIKE :branch_like
		)`)
		args = append(args, sql.Named("branch_like", "%"+branch+"%"))
	}

	holder := strings.ToUpper(prepaidVisaSanitizeSearch(req.Cardholder))
	if holder != "" && includeCardholder {
		parts = append(parts, `(
			UPPER(TRIM(NVL(c.FIRSTNAME, '') || ' ' || NVL(c.LASTNAME, ''))) LIKE :holder_like
			OR UPPER(TRIM(NVL(c.EMBOSSNAME, ' '))) LIKE :holder_like
		)`)
		args = append(args, sql.Named("holder_like", "%"+holder+"%"))
	}

	q := strings.ToUpper(prepaidVisaSanitizeSearch(req.Q))
	if q != "" {
		qCols := `
			UPPER(TRIM(NVL(t.RRN, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(t.CRDACPTLOC, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(t.CRDACPTID, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(t.TERMCODE, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(c.PAN_DISPLAY, ' '))) LIKE :q_like
			OR SUBSTR(TRIM(c.PAN_DISPLAY), -4) = :q_exact
			OR UPPER(TRIM(NVL(b.DESCR, ' '))) LIKE :q_like
			OR TO_CHAR(NVL(t.AMTBILL, 0)) LIKE :q_like`
		if includeCardholder {
			qCols += `
			OR UPPER(TRIM(NVL(c.FIRSTNAME, '') || ' ' || NVL(c.LASTNAME, ''))) LIKE :q_like
			OR UPPER(TRIM(NVL(c.EMBOSSNAME, ' '))) LIKE :q_like`
		}
		parts = append(parts, "("+qCols+")")
		args = append(args,
			sql.Named("q_like", "%"+q+"%"),
			sql.Named("q_exact", q),
		)
	}

	rrn := strings.ToUpper(prepaidVisaSanitizeSearch(req.RRN))
	if rrn != "" {
		parts = append(parts, `UPPER(TRIM(NVL(t.RRN, ' '))) LIKE :rrn_like`)
		args = append(args, sql.Named("rrn_like", rrn+"%"))
	}
	merchant := strings.ToUpper(prepaidVisaSanitizeSearch(req.Merchant))
	if merchant != "" {
		parts = append(parts, `(
			UPPER(TRIM(NVL(t.CRDACPTLOC, ' '))) LIKE :merch_like
			OR UPPER(TRIM(NVL(t.CRDACPTID, ' '))) LIKE :merch_like
		)`)
		args = append(args, sql.Named("merch_like", "%"+merchant+"%"))
	}
	term := strings.ToUpper(prepaidVisaSanitizeSearch(req.Terminal))
	if term != "" {
		parts = append(parts, `UPPER(TRIM(NVL(t.TERMCODE, ' '))) LIKE :term_like`)
		args = append(args, sql.Named("term_like", "%"+term+"%"))
	}
	txnCode := cortexTxnSanitizeDigits(req.TxnCode, 8)
	if txnCode != "" {
		parts = append(parts, `TO_CHAR(t.TXNCODE) LIKE :txn_code_like`)
		args = append(args, sql.Named("txn_code_like", txnCode+"%"))
	}
	if req.TlogID != nil && *req.TlogID > 0 {
		parts = append(parts, `t.ID = :tlog_id_filter`)
		args = append(args, sql.Named("tlog_id_filter", *req.TlogID))
	}
	stan := cortexTxnSanitizeDigits(req.STAN, 12)
	if stan != "" {
		parts = append(parts, `(
			TO_CHAR(t.STAN) LIKE :stan_like
			OR TO_CHAR(t.STANORG) LIKE :stan_like
		)`)
		args = append(args, sql.Named("stan_like", stan+"%"))
	}
	account := strings.ToUpper(prepaidVisaSanitizeSearch(req.Account))
	if account != "" {
		parts = append(parts, `(
			UPPER(TRIM(NVL(t.ACNUM1, ' '))) LIKE :acct_like
			OR UPPER(TRIM(NVL(t.ACNUM2, ' '))) LIKE :acct_like
		)`)
		args = append(args, sql.Named("acct_like", "%"+account+"%"))
	}
	approval := strings.ToUpper(prepaidVisaSanitizeSearch(req.ApprovalCode))
	if approval != "" {
		parts = append(parts, `UPPER(TRIM(NVL(t.APRVLCODE, ' '))) LIKE :aprvl_like`)
		args = append(args, sql.Named("aprvl_like", approval+"%"))
	}
	rsp := strings.ToUpper(prepaidVisaSanitizeSearch(req.RspCode))
	if rsp != "" {
		parts = append(parts, `UPPER(TRIM(NVL(t.RSPCODE, ' '))) = :rsp_exact`)
		args = append(args, sql.Named("rsp_exact", rsp))
	}
	currency := cortexTxnSanitizeDigits(req.Currency, 4)
	if currency != "" {
		parts = append(parts, `TRIM(TO_CHAR(t.CURBILL)) = :cur_exact`)
		args = append(args, sql.Named("cur_exact", currency))
	}
	mcc := cortexTxnSanitizeDigits(req.MCC, 4)
	if mcc != "" {
		parts = append(parts, `TO_CHAR(t.CRDACPTBUS) LIKE :mcc_like`)
		args = append(args, sql.Named("mcc_like", mcc+"%"))
	}
	acqCountry := strings.ToUpper(prepaidVisaSanitizeSearch(req.AcquiringCountry))
	if acqCountry != "" {
		parts = append(parts, `UPPER(TRIM(NVL(t.ACQCOUNTRY, ' '))) LIKE :acq_ctry_like`)
		args = append(args, sql.Named("acq_ctry_like", acqCountry+"%"))
	}
	msgType := cortexTxnSanitizeDigits(req.MsgType, 6)
	if msgType != "" {
		parts = append(parts, `TRIM(TO_CHAR(t.MSGCLS)) = :msg_type_exact`)
		args = append(args, sql.Named("msg_type_exact", msgType))
	}
	switch strings.ToLower(strings.TrimSpace(req.Result)) {
	case "approved":
		parts = append(parts, `TRIM(t.RSPCODE) = '00'`)
	case "declined":
		parts = append(parts, `TRIM(NVL(t.RSPCODE, ' ')) <> '00'`)
	}
	switch strings.ToLower(strings.TrimSpace(req.Reversal)) {
	case "exclude":
		parts = append(parts, `t.MSGCLS NOT IN (4, 410, 420, 430)`)
	case "only":
		parts = append(parts, `t.MSGCLS IN (4, 410, 420, 430)`)
	}
	if req.AmountMin != nil {
		parts = append(parts, `NVL(t.AMTBILL, 0) >= :amt_min`)
		args = append(args, sql.Named("amt_min", *req.AmountMin))
	}
	if req.AmountMax != nil {
		parts = append(parts, `NVL(t.AMTBILL, 0) <= :amt_max`)
		args = append(args, sql.Named("amt_max", *req.AmountMax))
	}

	if len(parts) == 0 {
		return "", nil
	}
	return " AND " + strings.Join(parts, " AND "), args
}

const cortexTxnTimeFmt = `CASE
	WHEN %s IS NULL THEN ''
	ELSE SUBSTR(LPAD(TO_CHAR(%s), 6, '0'), 1, 2)
		|| ':' || SUBSTR(LPAD(TO_CHAR(%s), 6, '0'), 3, 2)
		|| ':' || SUBSTR(LPAD(TO_CHAR(%s), 6, '0'), 5, 2)
END`

func cortexTxnTimeSQL(col string) string {
	return fmt.Sprintf(cortexTxnTimeFmt, col, col, col, col)
}

func (r *cortexTransactionSearchRepository) GetByID(
	ctx context.Context,
	tlogID int64,
	includeCardholder bool,
) (*model.CortexTransactionDetail, error) {
	cardholder := prepaidVisaCardholderNull
	if includeCardholder {
		cardholder = prepaidVisaCardholderPermitted
	}

	q := fmt.Sprintf(`
		SELECT
			t.ID AS TLOG_ID,
			c.ID AS CARD_ID,
			SUBSTR(NVL(c.PAN_DISPLAY, t.PAN_DISPLAY), 1, 6) || 'XXXXXX' || SUBSTR(NVL(c.PAN_DISPLAY, t.PAN_DISPLAY), -4) AS CARD_MASKED,
			%s
			NVL(SUBSTR(TRIM(t.CRDPRODUCT), 1, 3), TO_CHAR(c.CRDPRODUCT_ID)) AS PRODUCT_CODE,
			NVL(TRIM(p.DESCR), 'Card product') AS PRODUCT_NAME,
			TRIM(c.STATCODE) AS STATUS_CODE,
			TRIM(s.DESCR) AS STATUS_DESCRIPTION,
			TRIM(b.BRNCODE) AS BRANCH_CODE,
			TRIM(b.DESCR) AS BRANCH_NAME,
			TRIM(t.RRN) AS RRN,
			TO_CHAR(t.STAN) AS STAN,
			TO_CHAR(t.STANORG) AS STAN_ORG,
			TRIM(t.TRN) AS TRN,
			TRIM(t.ARN) AS ARN,
			TO_CHAR(t.CTXDATE, 'YYYY-MM-DD') AS TXN_DATE,
			%s AS TXN_TIME,
			TO_CHAR(t.DATELOCAL, 'YYYY-MM-DD') AS LOCAL_DATE,
			%s AS LOCAL_TIME,
			TO_CHAR(t.DATEXMIT, 'YYYY-MM-DD') AS XMIT_DATE,
			%s AS XMIT_TIME,
			TRIM(t.WHEN_CREATED) AS WHEN_CREATED,
			TRIM(TO_CHAR(t.MSGCLS)) AS MSG_CLS,
			TRIM(TO_CHAR(t.MSGFN)) AS MSG_FN,
			TO_CHAR(t.TXNCODE) AS TXN_CODE,
			TRIM(t.SUB_TXNCODE) AS SUB_TXN_CODE,
			TO_CHAR(t.TXNSTATUS) AS TXN_STATUS,
			TRIM(t.RSPCODE) AS RSP_CODE,
			TRIM(t.ACTIONCODE) AS ACTION_CODE,
			TO_CHAR(t.REASONCODE) AS REASON_CODE,
			TRIM(t.APRVLCODE) AS APRVL_CODE,
			TRIM(TO_CHAR(t.RSPSRC)) AS RSP_SRC,
			TO_CHAR(t.STIPREASON) AS STIP_REASON,
			TO_CHAR(t.REJREASON) AS REJ_REASON,
			TO_CHAR(t.FNCODE) AS FN_CODE,
			TO_CHAR(t.AUTHLIFE) AS AUTH_LIFE,
			TO_CHAR(t.AUTH_EXPDATE, 'YYYY-MM-DD') AS AUTH_EXP,
			TRIM(t.SCHEME) AS SCHEME,
			TRIM(t.CLEARED) AS CLEARED,
			TRIM(t.TERMCODE) AS TERMINAL_ID,
			TRIM(t.TERMTYPE) AS TERMINAL_TYPE,
			TRIM(t.CRDACPTLOC) AS MERCHANT_NAME,
			TRIM(t.CRDACPTID) AS MERCHANT_ID,
			TO_CHAR(t.CRDACPTBUS) AS MERCHANT_BUS,
			TRIM(t.CRDACPTLOC_NAME) AS MRCH_LOC_NAME,
			TRIM(t.CRDACPTLOC_STREET) AS MRCH_STREET,
			TRIM(t.CRDACPTLOC_CITY) AS MRCH_CITY,
			TRIM(t.CRDACPTLOC_POSTCODE) AS MRCH_POST,
			TRIM(t.CRDACPTLOC_REGION) AS MRCH_REGION,
			TRIM(t.CRDACPTLOC_COUNTRY) AS MRCH_COUNTRY,
			TRIM(t.ACQCOUNTRY) AS ACQ_COUNTRY,
			TRIM(TO_CHAR(t.TXNSRC)) AS TXN_SRC,
			TRIM(t.SRC_IID) AS SRC_IID,
			TRIM(t.SRC_IID_COUNTRY) AS SRC_COUNTRY,
			TRIM(t.DEST_IID) AS DEST_IID,
			TRIM(t.DEST_IID_COUNTRY) AS DEST_COUNTRY,
			TRIM(t.ROUTE_IID) AS ROUTE_IID,
			TRIM(t.AIID) AS AIID,
			TRIM(t.FIID) AS FIID,
			TRIM(t.RIID) AS RIID,
			TRIM(t.SIID) AS SIID,
			%s AS AMOUNT,
			TRIM(TO_CHAR(t.CURBILL)) AS CURRENCY,
			%s AS AMOUNT_TXN,
			TRIM(TO_CHAR(t.CURTXN)) AS TXN_CURRENCY,
			NVL(t.AMTTXNORG, 0) AS AMT_TXN_ORG,
			NVL(t.AMTTXNCB, 0) AS AMT_CB,
			NVL(t.AMTTXNFEE, 0) AS AMT_TXN_FEE,
			NVL(t.AMTPROCFEE, 0) AS AMT_PROC_FEE,
			NVL(t.AMTTAX, 0) AS AMT_TAX,
			NVL(t.AMTCOM, 0) AS AMT_COM,
			NVL(t.AMTSET, 0) AS AMT_SET,
			TRIM(TO_CHAR(t.CURSET)) AS CUR_SET,
			NVL(t.RATESET, 0) AS RATE_SET,
			NVL(t.RATEBILL, 0) AS RATE_BILL,
			TRIM(t.ACNUM1) AS ACNUM1,
			TO_CHAR(t.ACTYPE1) AS ACTYPE1,
			TRIM(t.ACNUM2) AS ACNUM2,
			TO_CHAR(t.ACTYPE2) AS ACTYPE2,
			TRIM(t.POSCAP) AS POS_CAP,
			TRIM(t.POSCDIM) AS POS_ENTRY,
			TO_CHAR(t.CRDSEQNO) AS CRD_SEQ,
			TO_CHAR(t.ATC) AS ATC,
			TO_CHAR(t.SVCCODE) AS SVC_CODE,
			TRIM(t.DATEEXP) AS DATE_EXP
		FROM cortex.tlog t
		LEFT JOIN cortex.crddet c ON c.ID = t.CRDDET_ID
		LEFT JOIN cortex.crdproduct p ON p.ID = c.CRDPRODUCT_ID
		LEFT JOIN cortex.crdstatus s ON TRIM(c.STATCODE) = TRIM(s.STATCODE)
		LEFT JOIN cortex.branch b ON b.ID = c.BRANCH_ID
		WHERE t.ID = :tlog_id
	`,
		cardholder,
		cortexTxnTimeSQL("t.TIMELOCAL"),
		cortexTxnTimeSQL("t.TIMELOCAL"),
		cortexTxnTimeSQL("t.TIMEXMIT"),
		cortexTxnSignedAmtBill,
		cortexTxnSignedAmtTxn,
	)

	row := r.db.QueryRowContext(ctx, q, sql.Named("tlog_id", tlogID))

	var (
		id, cardID                                                         sql.NullInt64
		cardMasked, holder, productCode, productName                       sql.NullString
		statusCode, statusDesc, branchCode, branchName                     sql.NullString
		rrn, stan, stanOrg, trn, arn                                       sql.NullString
		date, timeLocal, localDate, localTime, xmitDate, xmitTime, created sql.NullString
		msgCls, msgFn, txnCode, subTxn, txnStatus                          sql.NullString
		rspCode, actionCode, reasonCode, aprvl                             sql.NullString
		rspSrc, stip, rej, fnCode, authLife, authExp, scheme, cleared      sql.NullString
		termID, termType, merchName, merchID, merchBus                     sql.NullString
		locName, street, city, post, region, country, acqCountry           sql.NullString
		txnSrc, srcIID, srcCountry, destIID, destCountry, routeIID         sql.NullString
		aiid, fiid, riid, siid                                             sql.NullString
		amount, amountTxn, amtOrg, amtCB, amtFee, amtProc                  sql.NullFloat64
		amtTax, amtCom, amtSet, rateSet, rateBill                          sql.NullFloat64
		currency, txnCurrency, curSet                                      sql.NullString
		acnum1, actype1, acnum2, actype2                                   sql.NullString
		posCap, posEntry, crdSeq, atc, svc, dateExp                        sql.NullString
	)

	err := row.Scan(
		&id, &cardID, &cardMasked, &holder,
		&productCode, &productName, &statusCode, &statusDesc, &branchCode, &branchName,
		&rrn, &stan, &stanOrg, &trn, &arn,
		&date, &timeLocal, &localDate, &localTime, &xmitDate, &xmitTime, &created,
		&msgCls, &msgFn, &txnCode, &subTxn, &txnStatus,
		&rspCode, &actionCode, &reasonCode, &aprvl,
		&rspSrc, &stip, &rej, &fnCode, &authLife, &authExp, &scheme, &cleared,
		&termID, &termType, &merchName, &merchID, &merchBus,
		&locName, &street, &city, &post, &region, &country, &acqCountry,
		&txnSrc, &srcIID, &srcCountry, &destIID, &destCountry, &routeIID,
		&aiid, &fiid, &riid, &siid,
		&amount, &currency, &amountTxn, &txnCurrency,
		&amtOrg, &amtCB, &amtFee, &amtProc, &amtTax, &amtCom, &amtSet, &curSet, &rateSet, &rateBill,
		&acnum1, &actype1, &acnum2, &actype2,
		&posCap, &posEntry, &crdSeq, &atc, &svc, &dateExp,
	)
	if err == sql.ErrNoRows {
		return nil, common.ErrCortexTransactionNotFound
	}
	if err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}

	return &model.CortexTransactionDetail{
		TlogID:             id.Int64,
		CardID:             cardID.Int64,
		CardMasked:         cardMasked.String,
		CardholderName:     holder.String,
		ProductCode:        productCode.String,
		ProductName:        productName.String,
		StatusCode:         statusCode.String,
		StatusDescription:  statusDesc.String,
		BranchCode:         branchCode.String,
		BranchName:         branchName.String,
		RRN:                rrn.String,
		STAN:               stan.String,
		OriginalSTAN:       stanOrg.String,
		TRN:                trn.String,
		ARN:                arn.String,
		Date:               date.String,
		Time:               timeLocal.String,
		LocalDate:          localDate.String,
		LocalTime:          localTime.String,
		TransmitDate:       xmitDate.String,
		TransmitTime:       xmitTime.String,
		CreatedAt:          created.String,
		MsgClass:           msgCls.String,
		MsgFunction:        msgFn.String,
		TxnCode:            txnCode.String,
		SubTxnCode:         subTxn.String,
		TxnStatus:          txnStatus.String,
		RspCode:            rspCode.String,
		ActionCode:         actionCode.String,
		ReasonCode:         reasonCode.String,
		ApprovalCode:       aprvl.String,
		Approved:           rspCode.String == "00",
		RspSource:          rspSrc.String,
		StipReason:         stip.String,
		RejectReason:       rej.String,
		FunctionCode:       fnCode.String,
		AuthLife:           authLife.String,
		AuthExpiry:         authExp.String,
		Scheme:             scheme.String,
		Cleared:            cleared.String,
		TerminalID:         termID.String,
		TerminalType:       termType.String,
		MerchantName:       merchName.String,
		MerchantID:         merchID.String,
		MerchantBusiness:   merchBus.String,
		MerchantLocName:    locName.String,
		MerchantStreet:     street.String,
		MerchantCity:       city.String,
		MerchantPostcode:   post.String,
		MerchantRegion:     region.String,
		MerchantCountry:    country.String,
		AcquirerCountry:    acqCountry.String,
		TxnSource:          txnSrc.String,
		SourceIID:          srcIID.String,
		SourceCountry:      srcCountry.String,
		DestIID:            destIID.String,
		DestCountry:        destCountry.String,
		RouteIID:           routeIID.String,
		AcquiringIID:       aiid.String,
		ForwardingIID:      fiid.String,
		ReceivingIID:       riid.String,
		SettlementIID:      siid.String,
		Amount:             amount.Float64,
		Currency:           currency.String,
		AmountTxn:          amountTxn.Float64,
		TxnCurrency:        txnCurrency.String,
		AmountTxnOrg:       amtOrg.Float64,
		AmountCashback:     amtCB.Float64,
		AmountTxnFee:       amtFee.Float64,
		AmountProcFee:      amtProc.Float64,
		AmountTax:          amtTax.Float64,
		AmountCommission:   amtCom.Float64,
		AmountSettlement:   amtSet.Float64,
		SettlementCurrency: curSet.String,
		SettlementRate:     rateSet.Float64,
		BillingRate:        rateBill.Float64,
		Account1:           acnum1.String,
		Account1Type:       actype1.String,
		Account2:           acnum2.String,
		Account2Type:       actype2.String,
		PosCapability:      posCap.String,
		PosEntryMode:       posEntry.String,
		CardSeqNo:          crdSeq.String,
		ATC:                atc.String,
		ServiceCode:        svc.String,
		ExpiryDate:         dateExp.String,
	}, nil
}
