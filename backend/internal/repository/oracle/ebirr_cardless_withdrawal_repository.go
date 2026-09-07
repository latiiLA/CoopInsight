package oracle

import (
	"context"
	"database/sql"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

const ebirrCardlessWithdrawalQuery = `
SELECT
	tl.RRN AS rrn,
	tl.CRDACPTLOC AS terminal_name,
	tl.CRDACPTID AS terminal_location,
	tl.TERMCODE AS terminal_id,
	tl.ACNUM1 AS account_number,
	tl.RSPCODE AS response,
	TO_CHAR(tl.DATELOCAL, 'MON DD, YYYY') AS txn_date,
	eb.AMOUNT AS amount,
	eb.CUSTOMER_MOBILE AS customer_mobile,
	REGEXP_REPLACE(eb.EXT_TXNID, '^E', '') AS ext_txnid,
	LPAD(eb.ID, 8, '0') AS bank_transfer_id
FROM cortex.tlog tl,
	cortex.ebirr_cardless_cw eb
WHERE tl.id = eb.CONFIRM_TLOG_ID
	AND tl.DATELOCAL BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY')
ORDER BY tl.DATELOCAL DESC, tl.RRN
`

type ebirrCardlessWithdrawalRepository struct {
	db *sql.DB
}

func NewEbirrCardlessWithdrawalRepository(db *sql.DB) repository.EbirrCardlessWithdrawalRepository {
	return &ebirrCardlessWithdrawalRepository{
		db: db,
	}
}

func (r *ebirrCardlessWithdrawalRepository) GetReport(
	ctx context.Context,
	dateFrom, dateTo string,
) ([]model.EbirrCardlessWithdrawal, error) {
	rows, err := r.db.QueryContext(
		ctx,
		ebirrCardlessWithdrawalQuery,
		sql.Named("date_from", dateFrom),
		sql.Named("date_to", dateTo),
	)
	if err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	results := make([]model.EbirrCardlessWithdrawal, 0)

	for rows.Next() {
		var (
			rrn              sql.NullString
			terminalName     sql.NullString
			terminalLocation sql.NullString
			terminalID       sql.NullString
			accountNumber    sql.NullString
			response         sql.NullString
			txnDate          sql.NullString
			amount           sql.NullFloat64
			customerMobile   sql.NullString
			extTxnID         sql.NullString
			bankTransferID   sql.NullString
		)

		if err := rows.Scan(
			&rrn,
			&terminalName,
			&terminalLocation,
			&terminalID,
			&accountNumber,
			&response,
			&txnDate,
			&amount,
			&customerMobile,
			&extTxnID,
			&bankTransferID,
		); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}

		row := model.EbirrCardlessWithdrawal{
			RRN:              rrn.String,
			TerminalName:     terminalName.String,
			TerminalLocation: terminalLocation.String,
			TerminalID:       terminalID.String,
			AccountNumber:    accountNumber.String,
			Response:         response.String,
			Date:             txnDate.String,
			Amount:           0,
			CustomerMobile:   customerMobile.String,
			ExtTxnID:         extTxnID.String,
			BankTransferID:   bankTransferID.String,
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
