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

type switchTransactionSearchRepository struct {
	db *sql.DB
}

func NewSwitchTransactionSearchRepository(db *sql.DB) repository.SwitchTransactionSearchRepository {
	return &switchTransactionSearchRepository{db: db}
}

func (r *switchTransactionSearchRepository) Search(
	ctx context.Context,
	req model.SwitchTransactionSearchRequest,
	page, pageSize int,
) (*model.SwitchTransactionSearchResult, error) {
	page, pageSize = normalizePrepaidVisaPage(page, pageSize)
	offset := (page - 1) * pageSize
	fetchLimit := pageSize + 1

	dateSQL, dateArgs := switchTxnLocalDateClause(req.DateFrom, req.DateTo)
	filterSQL, filterArgs := switchTxnSearchFilterClause(req)

	q := fmt.Sprintf(`
		SELECT
			ROWIDTOCHAR(t.ROWID) AS ROW_ID,
			TO_CHAR(t.LOCAL_DATE, 'YYYY-MM-DD') AS TXN_DATE,
			%s AS TXN_TIME,
			TRIM(t.REFNUM) AS RRN,
			TO_CHAR(t.TRACE) AS TRACE_NO,
			TRIM(t.MASK_PAN) AS CARD_MASKED,
			TRIM(t.CARDPRODUCT) AS PRODUCT_CODE,
			TRIM(t.TERMID) AS TERMINAL_ID,
			TRIM(t.ACCEPTORNAME) AS MERCHANT_NAME,
			TRIM(t.TERMLOC) AS TERM_LOC,
			CASE
				WHEN t.MSGTYPE IN (410, 420, 430) THEN -NVL(t.AMOUNT, 0)
				ELSE NVL(t.AMOUNT, 0)
			END AS AMOUNT,
			TRIM(TO_CHAR(t.ISS_CURRENCY_CODE)) AS ISS_CUR,
			TRIM(TO_CHAR(t.ACQ_CURRENCY_CODE)) AS ACQ_CUR,
			TRIM(TO_CHAR(t.RESPCODE)) AS RSP_CODE,
			TO_CHAR(t.MSGTYPE) AS MSG_TYPE,
			TO_CHAR(t.PCODE) AS TXN_CODE,
			TRIM(t.ACQUIRER) AS ACQUIRER,
			TRIM(t.TXNSRC) AS TXN_SRC,
			TRIM(t.TXNDEST) AS TXN_DEST,
			TO_CHAR(t.MERCHANT_TYPE) AS MCC
		FROM oasis.shclog t
		WHERE 1=1
			%s
			%s
		ORDER BY t.LOCAL_DATE DESC, t.LOCAL_TIME DESC, t.REFNUM DESC
		OFFSET :offset ROWS
		FETCH NEXT :fetch_limit ROWS ONLY
	`,
		switchTxnTimeSQL("t.LOCAL_TIME"),
		dateSQL,
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

	out := make([]model.SwitchTransaction, 0, pageSize)
	for rows.Next() {
		var (
			rowID, date, time, rrn, trace, card, product          sql.NullString
			termID, merchant, termLoc, issCur, acqCur, rsp        sql.NullString
			msgType, txnCode, acquirer, txnSrc, txnDest, mcc      sql.NullString
			amount                                                sql.NullFloat64
		)
		if err := rows.Scan(
			&rowID, &date, &time, &rrn, &trace, &card, &product,
			&termID, &merchant, &termLoc, &amount, &issCur, &acqCur, &rsp,
			&msgType, &txnCode, &acquirer, &txnSrc, &txnDest, &mcc,
		); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}
		rspCode := strings.TrimSpace(rsp.String)
		out = append(out, model.SwitchTransaction{
			RowID:            rowID.String,
			Date:             date.String,
			Time:             time.String,
			RRN:              strings.TrimSpace(rrn.String),
			Trace:            strings.TrimSpace(trace.String),
			CardMasked:       strings.TrimSpace(card.String),
			ProductCode:      strings.TrimSpace(product.String),
			TerminalID:       strings.TrimSpace(termID.String),
			MerchantName:     strings.TrimSpace(merchant.String),
			TerminalLocation: strings.TrimSpace(termLoc.String),
			Amount:           amount.Float64,
			IssuerCurrency:   strings.TrimSpace(issCur.String),
			AcquirerCurrency: strings.TrimSpace(acqCur.String),
			RspCode:          rspCode,
			Approved:         switchTxnIsApproved(rspCode),
			MsgType:          strings.TrimSpace(msgType.String),
			TxnCode:          strings.TrimSpace(txnCode.String),
			Acquirer:         strings.TrimSpace(acquirer.String),
			TxnSrc:           strings.TrimSpace(txnSrc.String),
			TxnDest:          strings.TrimSpace(txnDest.String),
			MCC:              strings.TrimSpace(mcc.String),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}

	hasMore := len(out) > pageSize
	pageRows := out
	if hasMore {
		pageRows = out[:pageSize]
	}
	return &model.SwitchTransactionSearchResult{
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
		Items:    pageRows,
	}, nil
}

func (r *switchTransactionSearchRepository) GetByRowID(
	ctx context.Context,
	rowID string,
) (*model.SwitchTransactionDetail, error) {
	rowID = strings.TrimSpace(rowID)
	if rowID == "" {
		return nil, common.ErrInvalidSwitchRowID
	}

	q := fmt.Sprintf(`
		SELECT
			ROWIDTOCHAR(t.ROWID) AS ROW_ID,
			TO_CHAR(t.LOCAL_DATE, 'YYYY-MM-DD') AS TXN_DATE,
			%s AS TXN_TIME,
			TO_CHAR(t.TRANDATE, 'YYYY-MM-DD') AS TRAN_DATE,
			%s AS TRAN_TIME,
			TO_CHAR(t.SETTLEMENT_DATE, 'YYYY-MM-DD') AS SETTLE_DATE,
			TRIM(t.REFNUM) AS RRN,
			TO_CHAR(t.TRACE) AS TRACE_NO,
			TO_CHAR(t.ORIGTRACE) AS ORIG_TRACE,
			TRIM(t.AUTHNUM) AS AUTH_NUM,
			TRIM(t.TRANS_ID) AS TRANS_ID,
			TRIM(t.INVOICE_NUMBER) AS INVOICE_NO,
			TRIM(t.MASK_PAN) AS CARD_MASKED,
			TRIM(t.CARDPRODUCT) AS PRODUCT_CODE,
			TO_CHAR(t.CARD_SEQNO) AS CARD_SEQ,
			TRIM(t.ACCTNUM) AS ACCOUNT,
			TO_CHAR(t.MSGTYPE) AS MSG_TYPE,
			TO_CHAR(t.ORIGMSG) AS ORIG_MSG,
			TO_CHAR(t.PCODE) AS TXN_CODE,
			TO_CHAR(t.TXNTYPE) AS TXN_TYPE,
			TRIM(TO_CHAR(t.RESPCODE)) AS RSP_CODE,
			TRIM(t.ALPHARESPONSECODE) AS ALPHA_RSP,
			TO_CHAR(t.REASON_CODE) AS REASON_CODE,
			TO_CHAR(t.REVCODE) AS REV_CODE,
			TRIM(t.TERMID) AS TERMINAL_ID,
			TRIM(t.TERMLOC) AS TERM_LOC,
			TRIM(t.ACCEPTORNAME) AS MERCHANT_NAME,
			TO_CHAR(t.MERCHANT_TYPE) AS MCC,
			TO_CHAR(t.ACQ_COUNTRY) AS ACQ_COUNTRY,
			TO_CHAR(t.STOREID) AS STORE_ID,
			TO_CHAR(t.BRANCH) AS BRANCH,
			TRIM(t.ACQUIRER) AS ACQUIRER,
			TRIM(t.ISSUER) AS ISSUER,
			TRIM(t.TXNSRC) AS TXN_SRC,
			TRIM(t.TXNDEST) AS TXN_DEST,
			TO_CHAR(t.SRC_NODE) AS SRC_NODE,
			TO_CHAR(t.DEST_NODE) AS DEST_NODE,
			CASE
				WHEN t.MSGTYPE IN (410, 420, 430) THEN -NVL(t.AMOUNT, 0)
				ELSE NVL(t.AMOUNT, 0)
			END AS AMOUNT,
			TRIM(TO_CHAR(t.ISS_CURRENCY_CODE)) AS ISS_CUR,
			TRIM(TO_CHAR(t.ACQ_CURRENCY_CODE)) AS ACQ_CUR,
			TRIM(TO_CHAR(NVL(t.TXN_CURRENCY_CODE, t.TRA_CURRENCY_CODE))) AS TXN_CUR,
			TRIM(TO_CHAR(t.CH_CURRENCY_CODE)) AS CH_CUR,
			TRIM(TO_CHAR(t.SETTLEMENT_CODE)) AS SET_CUR,
			NVL(t.SETTLEMENT_AMOUNT, 0) AS SET_AMT,
			NVL(t.TXN_AMOUNT, NVL(t.TRA_AMOUNT, 0)) AS TXN_AMT,
			NVL(t.CASH_BACK, 0) AS CASHBACK,
			NVL(t.FEE, 0) AS FEE,
			NVL(t.AVAL_BALANCE, 0) AS AVL_BAL,
			NVL(t.LEDGER_BALANCE, 0) AS LED_BAL,
			TO_CHAR(t.POS_ENTRY_CODE) AS POS_ENTRY,
			TO_CHAR(t.POS_CONDITION_CODE) AS POS_COND,
			TO_CHAR(t.DEVICE_CAP) AS DEVICE_CAP
		FROM oasis.shclog t
		WHERE t.ROWID = CHARTOROWID(:row_id)
	`,
		switchTxnTimeSQL("t.LOCAL_TIME"),
		switchTxnTimeSQL("t.TRANTIME"),
	)

	var (
		id, date, time, tranDate, tranTime, settleDate                    sql.NullString
		rrn, trace, origTrace, auth, transID, invoice                     sql.NullString
		card, product, cardSeq, account                                   sql.NullString
		msgType, origMsg, txnCode, txnType, rsp, alphaRsp, reason, rev    sql.NullString
		termID, termLoc, merchant, mcc, acqCtry, storeID, branch          sql.NullString
		acquirer, issuer, txnSrc, txnDest, srcNode, destNode              sql.NullString
		issCur, acqCur, txnCur, chCur, setCur, posEntry, posCond, device  sql.NullString
		amount, setAmt, txnAmt, cashback, fee, avl, led                   sql.NullFloat64
	)

	err := r.db.QueryRowContext(ctx, q, sql.Named("row_id", rowID)).Scan(
		&id, &date, &time, &tranDate, &tranTime, &settleDate,
		&rrn, &trace, &origTrace, &auth, &transID, &invoice,
		&card, &product, &cardSeq, &account,
		&msgType, &origMsg, &txnCode, &txnType, &rsp, &alphaRsp, &reason, &rev,
		&termID, &termLoc, &merchant, &mcc, &acqCtry, &storeID, &branch,
		&acquirer, &issuer, &txnSrc, &txnDest, &srcNode, &destNode,
		&amount, &issCur, &acqCur, &txnCur, &chCur, &setCur, &setAmt, &txnAmt,
		&cashback, &fee, &avl, &led, &posEntry, &posCond, &device,
	)
	if err == sql.ErrNoRows {
		return nil, common.ErrSwitchTxnNotFound
	}
	if err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}

	rspCode := strings.TrimSpace(rsp.String)
	return &model.SwitchTransactionDetail{
		RowID:              id.String,
		Date:               date.String,
		Time:               time.String,
		TranDate:           tranDate.String,
		TranTime:           tranTime.String,
		SettleDate:         settleDate.String,
		RRN:                strings.TrimSpace(rrn.String),
		Trace:              strings.TrimSpace(trace.String),
		OrigTrace:          strings.TrimSpace(origTrace.String),
		AuthNum:            strings.TrimSpace(auth.String),
		TransID:            strings.TrimSpace(transID.String),
		InvoiceNumber:      strings.TrimSpace(invoice.String),
		CardMasked:         strings.TrimSpace(card.String),
		ProductCode:        strings.TrimSpace(product.String),
		CardSeqNo:          strings.TrimSpace(cardSeq.String),
		Account:            strings.TrimSpace(account.String),
		MsgType:            strings.TrimSpace(msgType.String),
		OrigMsgType:        strings.TrimSpace(origMsg.String),
		TxnCode:            strings.TrimSpace(txnCode.String),
		TxnType:            strings.TrimSpace(txnType.String),
		RspCode:            rspCode,
		AlphaRspCode:       strings.TrimSpace(alphaRsp.String),
		ReasonCode:         strings.TrimSpace(reason.String),
		RevCode:            strings.TrimSpace(rev.String),
		Approved:           switchTxnIsApproved(rspCode),
		TerminalID:         strings.TrimSpace(termID.String),
		TerminalLocation:   strings.TrimSpace(termLoc.String),
		MerchantName:       strings.TrimSpace(merchant.String),
		MCC:                strings.TrimSpace(mcc.String),
		AcquiringCountry:   strings.TrimSpace(acqCtry.String),
		StoreID:            strings.TrimSpace(storeID.String),
		Branch:             strings.TrimSpace(branch.String),
		Acquirer:           strings.TrimSpace(acquirer.String),
		Issuer:             strings.TrimSpace(issuer.String),
		TxnSrc:             strings.TrimSpace(txnSrc.String),
		TxnDest:            strings.TrimSpace(txnDest.String),
		SrcNode:            strings.TrimSpace(srcNode.String),
		DestNode:           strings.TrimSpace(destNode.String),
		Amount:             amount.Float64,
		IssuerCurrency:     strings.TrimSpace(issCur.String),
		AcquirerCurrency:   strings.TrimSpace(acqCur.String),
		TxnCurrency:        strings.TrimSpace(txnCur.String),
		CardholderCurrency: strings.TrimSpace(chCur.String),
		SettlementCurrency: strings.TrimSpace(setCur.String),
		SettlementAmount:   setAmt.Float64,
		TxnAmount:          txnAmt.Float64,
		Cashback:           cashback.Float64,
		Fee:                fee.Float64,
		AvailableBalance:   avl.Float64,
		LedgerBalance:      led.Float64,
		PosEntryMode:       strings.TrimSpace(posEntry.String),
		PosCondition:       strings.TrimSpace(posCond.String),
		DeviceCap:          strings.TrimSpace(device.String),
	}, nil
}

func switchTxnIsApproved(rsp string) bool {
	return strings.TrimSpace(rsp) == "0"
}

func switchTxnLocalDateClause(dateFrom, dateTo string) (string, []any) {
	if strings.TrimSpace(dateFrom) == "" || strings.TrimSpace(dateTo) == "" {
		return ` AND t.LOCAL_DATE >= ADD_MONTHS(TRUNC(SYSDATE), -24)`, nil
	}
	return `
			AND t.LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
			AND t.LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1`,
		[]any{sql.Named("date_from", dateFrom), sql.Named("date_to", dateTo)}
}

func switchTxnTimeSQL(col string) string {
	return fmt.Sprintf(`CASE
	WHEN %s IS NULL THEN ''
	ELSE SUBSTR(LPAD(TO_CHAR(%s), 6, '0'), 1, 2)
		|| ':' || SUBSTR(LPAD(TO_CHAR(%s), 6, '0'), 3, 2)
		|| ':' || SUBSTR(LPAD(TO_CHAR(%s), 6, '0'), 5, 2)
END`, col, col, col, col)
}

func switchTxnSanitizeDigits(raw string, maxLen int) string {
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

func switchTxnSearchFilterClause(req model.SwitchTransactionSearchRequest) (string, []any) {
	var parts []string
	var args []any

	card := prepaidVisaSanitizeSearch(req.Card)
	if card != "" {
		cardUp := strings.ToUpper(card)
		parts = append(parts, `(
			UPPER(TRIM(NVL(t.MASK_PAN, ' '))) LIKE :card_like
			OR SUBSTR(TRIM(t.MASK_PAN), -4) = :card_exact
			OR SUBSTR(TRIM(t.PAN), -4) = :card_exact
		)`)
		args = append(args,
			sql.Named("card_like", "%"+cardUp+"%"),
			sql.Named("card_exact", cardUp),
		)
	}

	product := strings.ToUpper(prepaidVisaSanitizeSearch(req.Product))
	if product != "" {
		parts = append(parts, `UPPER(TRIM(NVL(t.CARDPRODUCT, ' '))) LIKE :prod_like`)
		args = append(args, sql.Named("prod_like", product+"%"))
	}

	q := strings.ToUpper(prepaidVisaSanitizeSearch(req.Q))
	if q != "" {
		parts = append(parts, `(
			UPPER(TRIM(NVL(t.REFNUM, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(t.ACCEPTORNAME, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(t.TERMLOC, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(t.TERMID, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(t.MASK_PAN, ' '))) LIKE :q_like
			OR SUBSTR(TRIM(t.MASK_PAN), -4) = :q_exact
			OR UPPER(TRIM(NVL(t.TXNSRC, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(t.TXNDEST, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(t.ACQUIRER, ' '))) LIKE :q_like
			OR TO_CHAR(NVL(t.AMOUNT, 0)) LIKE :q_like
		)`)
		args = append(args,
			sql.Named("q_like", "%"+q+"%"),
			sql.Named("q_exact", q),
		)
	}

	rrn := strings.ToUpper(prepaidVisaSanitizeSearch(req.RRN))
	if rrn != "" {
		parts = append(parts, `UPPER(TRIM(NVL(t.REFNUM, ' '))) LIKE :rrn_like`)
		args = append(args, sql.Named("rrn_like", rrn+"%"))
	}
	merchant := strings.ToUpper(prepaidVisaSanitizeSearch(req.Merchant))
	if merchant != "" {
		parts = append(parts, `(
			UPPER(TRIM(NVL(t.ACCEPTORNAME, ' '))) LIKE :merch_like
			OR UPPER(TRIM(NVL(t.TERMLOC, ' '))) LIKE :merch_like
		)`)
		args = append(args, sql.Named("merch_like", "%"+merchant+"%"))
	}
	term := strings.ToUpper(prepaidVisaSanitizeSearch(req.Terminal))
	if term != "" {
		parts = append(parts, `UPPER(TRIM(NVL(t.TERMID, ' '))) LIKE :term_like`)
		args = append(args, sql.Named("term_like", "%"+term+"%"))
	}
	txnCode := switchTxnSanitizeDigits(req.TxnCode, 12)
	if txnCode != "" {
		parts = append(parts, `TO_CHAR(t.PCODE) LIKE :txn_code_like`)
		args = append(args, sql.Named("txn_code_like", txnCode+"%"))
	}
	trace := switchTxnSanitizeDigits(req.Trace, 12)
	if trace != "" {
		parts = append(parts, `(
			TO_CHAR(t.TRACE) LIKE :trace_like
			OR TO_CHAR(t.ORIGTRACE) LIKE :trace_like
		)`)
		args = append(args, sql.Named("trace_like", trace+"%"))
	}
	account := strings.ToUpper(prepaidVisaSanitizeSearch(req.Account))
	if account != "" {
		parts = append(parts, `UPPER(TRIM(NVL(t.ACCTNUM, ' '))) LIKE :acct_like`)
		args = append(args, sql.Named("acct_like", "%"+account+"%"))
	}
	approval := strings.ToUpper(prepaidVisaSanitizeSearch(req.ApprovalCode))
	if approval != "" {
		parts = append(parts, `UPPER(TRIM(NVL(t.AUTHNUM, ' '))) LIKE :aprvl_like`)
		args = append(args, sql.Named("aprvl_like", approval+"%"))
	}
	rsp := strings.ToUpper(prepaidVisaSanitizeSearch(req.RspCode))
	if rsp != "" {
		parts = append(parts, `UPPER(TRIM(TO_CHAR(t.RESPCODE))) = :rsp_exact`)
		args = append(args, sql.Named("rsp_exact", rsp))
	}
	issCur := switchTxnSanitizeDigits(req.IssuerCurrency, 4)
	if issCur != "" {
		parts = append(parts, `TRIM(TO_CHAR(t.ISS_CURRENCY_CODE)) = :iss_cur`)
		args = append(args, sql.Named("iss_cur", issCur))
	}
	acqCur := switchTxnSanitizeDigits(req.AcquirerCurrency, 4)
	if acqCur != "" {
		parts = append(parts, `TRIM(TO_CHAR(t.ACQ_CURRENCY_CODE)) = :acq_cur`)
		args = append(args, sql.Named("acq_cur", acqCur))
	}
	mcc := switchTxnSanitizeDigits(req.MCC, 6)
	if mcc != "" {
		parts = append(parts, `TO_CHAR(t.MERCHANT_TYPE) LIKE :mcc_like`)
		args = append(args, sql.Named("mcc_like", mcc+"%"))
	}
	acqCountry := switchTxnSanitizeDigits(req.AcquiringCountry, 6)
	if acqCountry != "" {
		parts = append(parts, `TO_CHAR(t.ACQ_COUNTRY) LIKE :acq_ctry_like`)
		args = append(args, sql.Named("acq_ctry_like", acqCountry+"%"))
	}
	acquirer := strings.ToUpper(prepaidVisaSanitizeSearch(req.Acquirer))
	if acquirer != "" {
		parts = append(parts, `UPPER(TRIM(NVL(t.ACQUIRER, ' '))) LIKE :acq_like`)
		args = append(args, sql.Named("acq_like", "%"+acquirer+"%"))
	}

	routeID := strings.ToUpper(prepaidVisaSanitizeSearch(req.RouteID))
	if routeID != "" {
		like := "%" + routeID + "%"
		switch strings.ToLower(strings.TrimSpace(req.RouteMatch)) {
		case "source":
			parts = append(parts, `UPPER(TRIM(NVL(t.TXNSRC, ' '))) LIKE :route_like`)
		case "dest":
			parts = append(parts, `UPPER(TRIM(NVL(t.TXNDEST, ' '))) LIKE :route_like`)
		default: // either
			parts = append(parts, `(
				UPPER(TRIM(NVL(t.TXNSRC, ' '))) LIKE :route_like
				OR UPPER(TRIM(NVL(t.TXNDEST, ' '))) LIKE :route_like
			)`)
		}
		args = append(args, sql.Named("route_like", like))
	}

	switch strings.ToLower(strings.TrimSpace(req.Channel)) {
	case "atm":
		parts = append(parts, `t.MERCHANT_TYPE = 6011`)
	case "pos":
		parts = append(parts, `NVL(t.MERCHANT_TYPE, 0) <> 6011`)
	}

	msgType := switchTxnSanitizeDigits(req.MsgType, 6)
	if msgType != "" {
		parts = append(parts, `TO_CHAR(t.MSGTYPE) = :msg_type_exact`)
		args = append(args, sql.Named("msg_type_exact", msgType))
	}

	switch strings.ToLower(strings.TrimSpace(req.Result)) {
	case "approved":
		parts = append(parts, `TRIM(TO_CHAR(t.RESPCODE)) = '0'`)
	case "declined":
		parts = append(parts, `TRIM(TO_CHAR(NVL(t.RESPCODE, -1))) <> '0'`)
	}
	switch strings.ToLower(strings.TrimSpace(req.Reversal)) {
	case "exclude":
		parts = append(parts, `t.MSGTYPE NOT IN (410, 420, 430)`)
	case "only":
		parts = append(parts, `t.MSGTYPE IN (410, 420, 430)`)
	}
	if req.AmountMin != nil {
		parts = append(parts, `NVL(t.AMOUNT, 0) >= :amt_min`)
		args = append(args, sql.Named("amt_min", *req.AmountMin))
	}
	if req.AmountMax != nil {
		parts = append(parts, `NVL(t.AMOUNT, 0) <= :amt_max`)
		args = append(args, sql.Named("amt_max", *req.AmountMax))
	}

	if len(parts) == 0 {
		return "", nil
	}
	return " AND " + strings.Join(parts, " AND "), args
}
