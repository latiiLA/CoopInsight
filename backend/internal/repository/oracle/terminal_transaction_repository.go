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
