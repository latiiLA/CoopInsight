package oracle

import (
	"context"
	"database/sql"
	"strings"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

const unsettledBinQuery = `
SELECT` + clearingSelectColumns + `
FROM clearing.trans_log t
WHERE t.ISS_ACQ = 'ACQ'
	AND t.POS_ATM = 'POS'
	AND t.MSGTYPE = :msgType
	AND t.TR_RESPCODE = '0'
	AND t.TR_POSTED = 1
	AND t.TR_SETTLE = '0'
	AND t.TR_CONV_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
	AND t.TR_CONV_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1
	AND t.TR_SOURCE_BIN = :source_bin
	AND t.TR_DEST_BIN = :dest_bin
` + clearingAdviceNotExists + clearingOrderBy + clearingPageClause

type unsettledRepository struct {
	db *sql.DB
}

func NewUnsettledRepository(db *sql.DB) repository.UnsettledRepository {
	return &unsettledRepository{db: db}
}

func (r *unsettledRepository) List(
	ctx context.Context,
	msgType int64,
	dateFrom, dateTo string,
	sourceBin, destBin int64,
	page, pageSize int,
) ([]model.UnsettledTransaction, bool, error) {
	page, pageSize = normalizeClearingPage(page, pageSize)
	rows, err := r.db.QueryContext(
		ctx,
		unsettledBinQuery,
		clearingListArgs(msgType, sourceBin, destBin, dateFrom, dateTo, page, pageSize)...,
	)
	if err != nil {
		return nil, false, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	results, err := scanUnsettledRows(rows)
	if err != nil {
		return nil, false, err
	}

	trimmed, hasMore := trimClearingPage(results, pageSize)
	return trimmed, hasMore, nil
}

func scanUnsettledRows(rows *sql.Rows) ([]model.UnsettledTransaction, error) {
	results := make([]model.UnsettledTransaction, 0)

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

		results = append(results, model.UnsettledTransaction{
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
