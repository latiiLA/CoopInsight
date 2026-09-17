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

// Shared scheme BIN constants (uncleared + unsettled ETH).
const (
	sourceBinETH = int64(1000000011)
	destBinETH   = int64(1000000010)
)

// TRIM/RTRIM only where CLEARING.TRANS_LOG stores padding:
//   TR_CARDPRODUCT VARCHAR2(10) — often right-padded
//   TR_DBA         VARCHAR2(100) — sometimes trailing spaces
// TR_SOURCE_BIN / TR_DEST_BIN are NUMBER — compare as numbers, no TRIM.
// ISS_ACQ, POS_ATM, TR_RESPCODE, TR_ARF, etc. have no padding in recent data.
const unclearedSelectColumns = `
	NVL(t.TRANS_LOG_ID, t.ID) AS id,
	TO_CHAR(t.TR_ADDED_DATE, 'YYYY-MM-DD') AS tr_date,
	LPAD(TO_CHAR(NVL(t.TR_TIME, 0)), 6, '0') AS tr_time,
	NVL(t.MSGTYPE, 0) AS msgtype,
	NVL(t.PROC_CODE, 0) AS proc_code,
	t.TR_ARF AS rrn,
	LPAD(TO_CHAR(NVL(t.TR_TRACE, 0)), 6, '0') AS stan,
	t.TR_RESPCODE AS resp_code,
	NVL(t.TR_AMOUNT_SOURCE, 0) AS amount,
	NVL(t.TR_CURRENCY_SOURCE, 0) AS currency,
	t.TR_TERM_ID AS terminal_id,
	RTRIM(t.TR_DBA) AS merchant,
	RTRIM(t.TR_CARDPRODUCT) AS card_product,
	t.TR_TXNSRC AS txn_source,
	t.TR_TXNDEST AS txn_dest,
	t.ISS_ACQ AS issuer_acquirer,
	t.POS_ATM AS pos_atm
`

// Exclude 210s whose RRN (TR_ARF) matches a 410/420/430 reversal.
// Reversal rows themselves are never selected (MSGTYPE = 210 only).
const unclearedBaseWhere = `
WHERE t.ISS_ACQ = 'ACQ'
	AND t.POS_ATM = 'POS'
	AND t.MSGTYPE = 210
	AND t.TR_RESPCODE = '0'
	AND NVL(t.TR_POSTED, 0) = 0
	AND t.TR_SETTLE = '0'
	AND t.TR_ADDED_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
	AND t.TR_ADDED_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1
	AND NOT EXISTS (
		SELECT 1
		FROM clearing.trans_log r
		WHERE r.MSGTYPE IN (410, 420, 430)
			AND r.TR_ARF = t.TR_ARF
	)
`

const unclearedOrderBy = `
ORDER BY t.TR_ADDED_DATE DESC, t.TR_TIME DESC, t.TR_TRACE DESC
`

// Filter by TR_SOURCE_BIN + TR_DEST_BIN.
const unclearedBinQuery = `
SELECT` + unclearedSelectColumns + `
FROM clearing.trans_log t
` + unclearedBaseWhere + `
	AND t.TR_SOURCE_BIN = :source_bin
	AND t.TR_DEST_BIN = :dest_bin
` + unclearedOrderBy

type unclearedRepository struct {
	db *sql.DB
}

func NewUnclearedRepository(db *sql.DB) repository.UnclearedRepository {
	return &unclearedRepository{db: db}
}

func (r *unclearedRepository) List(
	ctx context.Context,
	dateFrom, dateTo string,
	sourceBin, destBin int64,
) ([]model.UnclearedTransaction, error) {
	rows, err := r.db.QueryContext(
		ctx,
		unclearedBinQuery,
		sql.Named("source_bin", sourceBin),
		sql.Named("dest_bin", destBin),
		sql.Named("date_from", dateFrom),
		sql.Named("date_to", dateTo),
	)
	if err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	return scanUnclearedRows(rows)
}

func scanUnclearedRows(rows *sql.Rows) ([]model.UnclearedTransaction, error) {
	results := make([]model.UnclearedTransaction, 0)

	for rows.Next() {
		var (
			id        sql.NullFloat64
			date      sql.NullString
			timeVal   sql.NullString
			msgType   sql.NullFloat64
			procCode  sql.NullFloat64
			rrn       sql.NullString
			stan      sql.NullString
			respCode  sql.NullString
			amount    sql.NullFloat64
			currency  sql.NullFloat64
			terminal  sql.NullString
			merchant  sql.NullString
			product   sql.NullString
			txnSource sql.NullString
			txnDest   sql.NullString
			issAcq    sql.NullString
			posAtm    sql.NullString
		)

		if err := rows.Scan(
			&id,
			&date,
			&timeVal,
			&msgType,
			&procCode,
			&rrn,
			&stan,
			&respCode,
			&amount,
			&currency,
			&terminal,
			&merchant,
			&product,
			&txnSource,
			&txnDest,
			&issAcq,
			&posAtm,
		); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}

		results = append(results, model.UnclearedTransaction{
			ID:             int64(id.Float64),
			Date:           strings.TrimSpace(date.String),
			Time:           formatClearingTime(timeVal.String),
			MsgType:        int64(msgType.Float64),
			ProcCode:       int64(procCode.Float64),
			RRN:            strings.TrimSpace(rrn.String),
			STAN:           strings.TrimSpace(stan.String),
			RespCode:       strings.TrimSpace(respCode.String),
			Amount:         amount.Float64,
			Currency:       int64(currency.Float64),
			TerminalID:     strings.TrimSpace(terminal.String),
			Merchant:       strings.TrimSpace(merchant.String),
			CardProduct:    strings.TrimSpace(product.String),
			TxnSource:      strings.TrimSpace(txnSource.String),
			TxnDest:        strings.TrimSpace(txnDest.String),
			IssuerAcquirer: strings.TrimSpace(issAcq.String),
			PosAtm:         strings.TrimSpace(posAtm.String),
		})
	}

	if err := rows.Err(); err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}

	return results, nil
}

func formatClearingTime(raw string) string {
	raw = strings.TrimSpace(raw)
	if len(raw) != 6 {
		return raw
	}

	return fmt.Sprintf("%s:%s:%s", raw[0:2], raw[2:4], raw[4:6])
}
