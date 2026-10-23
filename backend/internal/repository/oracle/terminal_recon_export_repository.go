package oracle

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

var terminalReconCortexHeaders = []string{
	"Date",
	"Time",
	"Terminal ID",
	"Merchant ID",
	"Merchant name",
	"RRN",
	"STAN",
	"Approval code",
	"Amount",
	"Billing currency",
	"Txn amount",
	"Txn currency",
	"Response code",
	"Message class",
	"Txn code",
	"Card",
	"Product",
	"Account",
	"Acquiring country",
}

var terminalReconSwitchHeaders = []string{
	"Date",
	"Time",
	"Terminal ID",
	"Merchant name",
	"Terminal location",
	"RRN",
	"Trace",
	"Approval code",
	"Amount",
	"Issuer currency",
	"Acquirer currency",
	"Response code",
	"Message type",
	"Processing code",
	"Card",
	"Product",
	"Account",
	"Acquirer",
	"Source",
	"Destination",
	"MCC",
}

type terminalReconExportRepository struct {
	db *sql.DB
}

func NewTerminalReconExportRepository(db *sql.DB) repository.TerminalReconExportRepository {
	return &terminalReconExportRepository{db: db}
}

func (r *terminalReconExportRepository) CortexHeaders() []string {
	return append([]string(nil), terminalReconCortexHeaders...)
}

func (r *terminalReconExportRepository) SwitchHeaders() []string {
	return append([]string(nil), terminalReconSwitchHeaders...)
}

func (r *terminalReconExportRepository) StreamCortex(
	ctx context.Context,
	req model.TerminalReconExportRequest,
	onRow repository.TerminalReconRowHandler,
) error {
	termSQL, termArgs := terminalReconExactTerm("t.TERMCODE", req.Terminal)
	q := fmt.Sprintf(`
		SELECT
			TO_CHAR(t.CTXDATE, 'YYYY-MM-DD') AS TXN_DATE,
			%s AS TXN_TIME,
			TRIM(t.TERMCODE) AS TERMINAL_ID,
			TRIM(t.CRDACPTID) AS MERCHANT_ID,
			TRIM(t.CRDACPTLOC) AS MERCHANT_NAME,
			TRIM(t.RRN) AS RRN,
			TO_CHAR(t.STAN) AS STAN,
			TRIM(t.APRVLCODE) AS APPROVAL_CODE,
			TO_CHAR(NVL(t.AMTBILL, 0)) AS AMOUNT,
			TRIM(TO_CHAR(t.CURBILL)) AS BILL_CUR,
			TO_CHAR(NVL(t.AMTTXN, 0)) AS AMT_TXN,
			TRIM(TO_CHAR(t.CURTXN)) AS TXN_CUR,
			TRIM(t.RSPCODE) AS RSP_CODE,
			TRIM(TO_CHAR(t.MSGCLS)) AS MSG_CLS,
			TO_CHAR(t.TXNCODE) AS TXN_CODE,
			SUBSTR(NVL(c.PAN_DISPLAY, t.PAN_DISPLAY), 1, 6) || 'XXXXXX' || SUBSTR(NVL(c.PAN_DISPLAY, t.PAN_DISPLAY), -4) AS CARD_MASKED,
			NVL(SUBSTR(TRIM(t.CRDPRODUCT), 1, 3), TO_CHAR(c.CRDPRODUCT_ID)) AS PRODUCT_CODE,
			TRIM(t.ACNUM1) AS ACCOUNT,
			TRIM(t.ACQCOUNTRY) AS ACQ_COUNTRY
		FROM cortex.tlog t
		LEFT JOIN cortex.crddet c ON c.ID = t.CRDDET_ID
		WHERE t.CTXDATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
			AND t.CTXDATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1
			AND TRIM(t.RSPCODE) = '00'
			%s
		ORDER BY t.CTXDATE ASC, t.TIMELOCAL ASC, t.ID ASC
	`, cortexTxnTimeSQL("t.TIMELOCAL"), termSQL)

	args := []any{
		sql.Named("date_from", req.DateFrom),
		sql.Named("date_to", req.DateTo),
	}
	args = append(args, termArgs...)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	cols := make([]sql.NullString, len(terminalReconCortexHeaders))
	ptrs := make([]any, len(cols))
	for i := range cols {
		ptrs[i] = &cols[i]
	}
	for rows.Next() {
		if err := rows.Scan(ptrs...); err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		values := make([]string, len(cols))
		for i, c := range cols {
			values[i] = strings.TrimSpace(c.String)
		}
		if err := onRow(values); err != nil {
			return err
		}
	}
	if err := rows.Err(); err != nil {
		return wrapError(common.ErrFailedToFetchReport, err)
	}
	return nil
}

func (r *terminalReconExportRepository) StreamSwitch(
	ctx context.Context,
	req model.TerminalReconExportRequest,
	onRow repository.TerminalReconRowHandler,
) error {
	termSQL, termArgs := terminalReconExactTerm("t.TERMID", req.Terminal)
	q := fmt.Sprintf(`
		SELECT
			TO_CHAR(t.LOCAL_DATE, 'YYYY-MM-DD') AS TXN_DATE,
			%s AS TXN_TIME,
			TRIM(t.TERMID) AS TERMINAL_ID,
			TRIM(t.ACCEPTORNAME) AS MERCHANT_NAME,
			TRIM(t.TERMLOC) AS TERM_LOC,
			TRIM(t.REFNUM) AS RRN,
			TO_CHAR(t.TRACE) AS TRACE_NO,
			TRIM(t.AUTHNUM) AS APPROVAL_CODE,
			TO_CHAR(NVL(t.AMOUNT, 0)) AS AMOUNT,
			TRIM(TO_CHAR(t.ISS_CURRENCY_CODE)) AS ISS_CUR,
			TRIM(TO_CHAR(t.ACQ_CURRENCY_CODE)) AS ACQ_CUR,
			TRIM(TO_CHAR(t.RESPCODE)) AS RSP_CODE,
			TO_CHAR(t.MSGTYPE) AS MSG_TYPE,
			TO_CHAR(t.PCODE) AS PROC_CODE,
			TRIM(t.MASK_PAN) AS CARD_MASKED,
			TRIM(t.CARDPRODUCT) AS PRODUCT_CODE,
			TRIM(t.ACCTNUM) AS ACCOUNT,
			TRIM(t.ACQUIRER) AS ACQUIRER,
			TRIM(t.TXNSRC) AS TXN_SRC,
			TRIM(t.TXNDEST) AS TXN_DEST,
			TO_CHAR(t.MERCHANT_TYPE) AS MCC
		FROM oasis.shclog t
		WHERE t.LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
			AND t.LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1
			AND TRIM(TO_CHAR(t.RESPCODE)) = '0'
			%s
		ORDER BY t.LOCAL_DATE ASC, t.LOCAL_TIME ASC, t.REFNUM ASC
	`, switchTxnTimeSQL("t.LOCAL_TIME"), termSQL)

	args := []any{
		sql.Named("date_from", req.DateFrom),
		sql.Named("date_to", req.DateTo),
	}
	args = append(args, termArgs...)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	cols := make([]sql.NullString, len(terminalReconSwitchHeaders))
	ptrs := make([]any, len(cols))
	for i := range cols {
		ptrs[i] = &cols[i]
	}
	for rows.Next() {
		if err := rows.Scan(ptrs...); err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		values := make([]string, len(cols))
		for i, c := range cols {
			values[i] = strings.TrimSpace(c.String)
		}
		if err := onRow(values); err != nil {
			return err
		}
	}
	if err := rows.Err(); err != nil {
		return wrapError(common.ErrFailedToFetchReport, err)
	}
	return nil
}

func (r *terminalReconExportRepository) ListCortexChunk(
	ctx context.Context,
	req model.TerminalReconChunkRequest,
) (*model.TerminalReconChunkResult, error) {
	page, pageSize := normalizePrepaidVisaPage(req.Page, req.PageSize)
	if pageSize > 5000 {
		pageSize = 5000
	}
	offset := (page - 1) * pageSize
	fetchLimit := pageSize + 1

	termSQL, termArgs := terminalReconExactTerm("t.TERMCODE", req.Terminal)
	q := fmt.Sprintf(`
		SELECT
			TO_CHAR(t.CTXDATE, 'YYYY-MM-DD') AS TXN_DATE,
			%s AS TXN_TIME,
			TRIM(t.TERMCODE) AS TERMINAL_ID,
			TRIM(t.CRDACPTID) AS MERCHANT_ID,
			TRIM(t.CRDACPTLOC) AS MERCHANT_NAME,
			TRIM(t.RRN) AS RRN,
			TO_CHAR(t.STAN) AS STAN,
			TRIM(t.APRVLCODE) AS APPROVAL_CODE,
			TO_CHAR(NVL(t.AMTBILL, 0)) AS AMOUNT,
			TRIM(TO_CHAR(t.CURBILL)) AS BILL_CUR,
			TO_CHAR(NVL(t.AMTTXN, 0)) AS AMT_TXN,
			TRIM(TO_CHAR(t.CURTXN)) AS TXN_CUR,
			TRIM(t.RSPCODE) AS RSP_CODE,
			TRIM(TO_CHAR(t.MSGCLS)) AS MSG_CLS,
			TO_CHAR(t.TXNCODE) AS TXN_CODE,
			SUBSTR(NVL(c.PAN_DISPLAY, t.PAN_DISPLAY), 1, 6) || 'XXXXXX' || SUBSTR(NVL(c.PAN_DISPLAY, t.PAN_DISPLAY), -4) AS CARD_MASKED,
			NVL(SUBSTR(TRIM(t.CRDPRODUCT), 1, 3), TO_CHAR(c.CRDPRODUCT_ID)) AS PRODUCT_CODE,
			TRIM(t.ACNUM1) AS ACCOUNT,
			TRIM(t.ACQCOUNTRY) AS ACQ_COUNTRY
		FROM cortex.tlog t
		LEFT JOIN cortex.crddet c ON c.ID = t.CRDDET_ID
		WHERE t.CTXDATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
			AND t.CTXDATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1
			AND TRIM(t.RSPCODE) = '00'
			%s
		ORDER BY t.CTXDATE ASC, t.TIMELOCAL ASC, t.ID ASC
		OFFSET :offset ROWS
		FETCH NEXT :fetch_limit ROWS ONLY
	`, cortexTxnTimeSQL("t.TIMELOCAL"), termSQL)

	args := []any{
		sql.Named("date_from", req.DateFrom),
		sql.Named("date_to", req.DateTo),
	}
	args = append(args, termArgs...)
	args = append(args,
		sql.Named("offset", offset),
		sql.Named("fetch_limit", fetchLimit),
	)

	rows, err := terminalReconScanRows(ctx, r.db, q, args, len(terminalReconCortexHeaders))
	if err != nil {
		return nil, err
	}
	hasMore := len(rows) > pageSize
	if hasMore {
		rows = rows[:pageSize]
	}
	return &model.TerminalReconChunkResult{
		Headers:  append([]string(nil), terminalReconCortexHeaders...),
		Rows:     rows,
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
	}, nil
}

func (r *terminalReconExportRepository) ListSwitchChunk(
	ctx context.Context,
	req model.TerminalReconChunkRequest,
) (*model.TerminalReconChunkResult, error) {
	page, pageSize := normalizePrepaidVisaPage(req.Page, req.PageSize)
	if pageSize > 5000 {
		pageSize = 5000
	}
	offset := (page - 1) * pageSize
	fetchLimit := pageSize + 1

	termSQL, termArgs := terminalReconExactTerm("t.TERMID", req.Terminal)
	q := fmt.Sprintf(`
		SELECT
			TO_CHAR(t.LOCAL_DATE, 'YYYY-MM-DD') AS TXN_DATE,
			%s AS TXN_TIME,
			TRIM(t.TERMID) AS TERMINAL_ID,
			TRIM(t.ACCEPTORNAME) AS MERCHANT_NAME,
			TRIM(t.TERMLOC) AS TERM_LOC,
			TRIM(t.REFNUM) AS RRN,
			TO_CHAR(t.TRACE) AS TRACE_NO,
			TRIM(t.AUTHNUM) AS APPROVAL_CODE,
			TO_CHAR(NVL(t.AMOUNT, 0)) AS AMOUNT,
			TRIM(TO_CHAR(t.ISS_CURRENCY_CODE)) AS ISS_CUR,
			TRIM(TO_CHAR(t.ACQ_CURRENCY_CODE)) AS ACQ_CUR,
			TRIM(TO_CHAR(t.RESPCODE)) AS RSP_CODE,
			TO_CHAR(t.MSGTYPE) AS MSG_TYPE,
			TO_CHAR(t.PCODE) AS PROC_CODE,
			TRIM(t.MASK_PAN) AS CARD_MASKED,
			TRIM(t.CARDPRODUCT) AS PRODUCT_CODE,
			TRIM(t.ACCTNUM) AS ACCOUNT,
			TRIM(t.ACQUIRER) AS ACQUIRER,
			TRIM(t.TXNSRC) AS TXN_SRC,
			TRIM(t.TXNDEST) AS TXN_DEST,
			TO_CHAR(t.MERCHANT_TYPE) AS MCC
		FROM oasis.shclog t
		WHERE t.LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
			AND t.LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1
			AND TRIM(TO_CHAR(t.RESPCODE)) = '0'
			%s
		ORDER BY t.LOCAL_DATE ASC, t.LOCAL_TIME ASC, t.REFNUM ASC
		OFFSET :offset ROWS
		FETCH NEXT :fetch_limit ROWS ONLY
	`, switchTxnTimeSQL("t.LOCAL_TIME"), termSQL)

	args := []any{
		sql.Named("date_from", req.DateFrom),
		sql.Named("date_to", req.DateTo),
	}
	args = append(args, termArgs...)
	args = append(args,
		sql.Named("offset", offset),
		sql.Named("fetch_limit", fetchLimit),
	)

	rows, err := terminalReconScanRows(ctx, r.db, q, args, len(terminalReconSwitchHeaders))
	if err != nil {
		return nil, err
	}
	hasMore := len(rows) > pageSize
	if hasMore {
		rows = rows[:pageSize]
	}
	return &model.TerminalReconChunkResult{
		Headers:  append([]string(nil), terminalReconSwitchHeaders...),
		Rows:     rows,
		Page:     page,
		PageSize: pageSize,
		HasMore:  hasMore,
	}, nil
}

func terminalReconScanRows(
	ctx context.Context,
	db *sql.DB,
	q string,
	args []any,
	colCount int,
) ([][]string, error) {
	rs, err := db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rs.Close() }()

	out := make([][]string, 0, 256)
	cols := make([]sql.NullString, colCount)
	ptrs := make([]any, colCount)
	for i := range cols {
		ptrs[i] = &cols[i]
	}
	for rs.Next() {
		if err := rs.Scan(ptrs...); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}
		values := make([]string, colCount)
		for i, c := range cols {
			values[i] = strings.TrimSpace(c.String)
		}
		out = append(out, values)
	}
	if err := rs.Err(); err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	return out, nil
}

func terminalReconExactTerm(column, terminal string) (string, []any) {
	term := strings.TrimSpace(terminal)
	if term == "" {
		return "", nil
	}
	return fmt.Sprintf(" AND UPPER(TRIM(NVL(%s, ' '))) = :term_exact", column),
		[]any{sql.Named("term_exact", strings.ToUpper(term))}
}
