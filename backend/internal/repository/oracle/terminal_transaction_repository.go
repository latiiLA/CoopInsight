package oracle

import (
	"context"
	"database/sql"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

const terminalTransactionQuery = `
SELECT
	tl.RRN AS rrn,
	tl.TERMCODE AS terminal_id,
	tl.CRDACPTLOC AS terminal_name,
	tl.CRDACPTID AS terminal_location,
	TO_CHAR(tl.TXNCODE) AS txn_code,
	tl.RSPCODE AS response,
	TO_CHAR(tl.TXNSTATUS) AS txn_status,
	TO_CHAR(tl.DATELOCAL, 'MON DD, YYYY') AS txn_date,
	tl.AMTTXN AS amount
FROM cortex.tlog tl
WHERE TRIM(tl.TERMCODE) = TRIM(:terminal_id)
	AND tl.DATELOCAL >= TO_DATE(:date_from, 'MM-DD-YYYY')
	AND tl.DATELOCAL < TO_DATE(:date_to, 'MM-DD-YYYY') + 1
ORDER BY tl.DATELOCAL DESC, tl.RRN DESC
`

const terminalPerformanceQuery = `
SELECT
	TRIM(tl.TERMCODE) AS terminal_id,
	MAX(tl.CRDACPTLOC) AS terminal_name,
	COUNT(*) AS transaction_count,
	SUM(CASE WHEN tl.RSPCODE = '00' THEN 1 ELSE 0 END) AS approved_count,
	SUM(tl.AMTTXN) AS total_amount,
	SUM(CASE WHEN tl.RSPCODE = '00' THEN tl.AMTTXN ELSE 0 END) AS approved_amount
FROM cortex.tlog tl
WHERE tl.DATELOCAL >= TO_DATE(:date_from, 'MM-DD-YYYY')
	AND tl.DATELOCAL < TO_DATE(:date_to, 'MM-DD-YYYY') + 1
	AND TRIM(tl.TERMCODE) IS NOT NULL
GROUP BY TRIM(tl.TERMCODE)
`

type terminalTransactionRepository struct {
	db *sql.DB
}

func NewTerminalTransactionRepository(db *sql.DB) repository.TerminalTransactionRepository {
	return &terminalTransactionRepository{
		db: db,
	}
}

func (r *terminalTransactionRepository) GetByTerminal(
	ctx context.Context,
	terminalID, dateFrom, dateTo string,
) ([]model.TerminalTransaction, error) {
	rows, err := r.db.QueryContext(
		ctx,
		terminalTransactionQuery,
		sql.Named("terminal_id", terminalID),
		sql.Named("date_from", dateFrom),
		sql.Named("date_to", dateTo),
	)
	if err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	results := make([]model.TerminalTransaction, 0)

	for rows.Next() {
		var (
			rrn              sql.NullString
			termID           sql.NullString
			terminalName     sql.NullString
			terminalLocation sql.NullString
			txnCode          sql.NullString
			response         sql.NullString
			txnStatus        sql.NullString
			txnDate          sql.NullString
			amount           sql.NullFloat64
		)

		if err := rows.Scan(
			&rrn,
			&termID,
			&terminalName,
			&terminalLocation,
			&txnCode,
			&response,
			&txnStatus,
			&txnDate,
			&amount,
		); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}

		row := model.TerminalTransaction{
			RRN:              rrn.String,
			TerminalID:       termID.String,
			TerminalName:     terminalName.String,
			TerminalLocation: terminalLocation.String,
			TxnCode:          txnCode.String,
			Response:         response.String,
			Status:           txnStatus.String,
			Date:             txnDate.String,
		}
		if amount.Valid {
			row.Amount = amount.Float64
		}

		results = append(results, row)
	}

	if err := rows.Err(); err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}

	return results, nil
}

func (r *terminalTransactionRepository) GetPerformance(
	ctx context.Context,
	dateFrom, dateTo string,
) ([]model.TerminalPerformanceRow, error) {
	rows, err := r.db.QueryContext(
		ctx,
		terminalPerformanceQuery,
		sql.Named("date_from", dateFrom),
		sql.Named("date_to", dateTo),
	)
	if err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	results := make([]model.TerminalPerformanceRow, 0)

	for rows.Next() {
		var (
			terminalID       sql.NullString
			terminalName     sql.NullString
			transactionCount sql.NullInt64
			approvedCount    sql.NullInt64
			totalAmount      sql.NullFloat64
			approvedAmount   sql.NullFloat64
		)

		if err := rows.Scan(
			&terminalID,
			&terminalName,
			&transactionCount,
			&approvedCount,
			&totalAmount,
			&approvedAmount,
		); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}

		row := model.TerminalPerformanceRow{
			TerminalID:   terminalID.String,
			TerminalName: terminalName.String,
		}
		if transactionCount.Valid {
			row.TransactionCount = int(transactionCount.Int64)
		}
		if approvedCount.Valid {
			row.ApprovedCount = int(approvedCount.Int64)
		}
		if totalAmount.Valid {
			row.Amount = totalAmount.Float64
		}
		if approvedAmount.Valid {
			row.ApprovedAmount = approvedAmount.Float64
		}

		results = append(results, row)
	}

	if err := rows.Err(); err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}

	return results, nil
}
