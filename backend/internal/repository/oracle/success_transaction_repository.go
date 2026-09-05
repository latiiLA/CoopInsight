package oracle

import (
	"context"
	"database/sql"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	dbrepo "github.com/latiiLA/CoopInsight/backend/internal/repository"
)

const approvedRespCodes = `'0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904'`

const classifiedRespCodes = `'0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','4','5','8','9','10','14','19','20','22','23','30','48','56','57','58','68','81','82','87','91','92','93','96','99','102','103','112','113','121','702','801','802','900','903','906','930','990','3','39','811'`

const successTransactionQuery = `
SELECT
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN respcode IN (` + approvedRespCodes + `) THEN 1 END) AS number_of_approved_txn,
	COUNT(CASE WHEN respcode = '4' THEN 1 END) AS do_not_honor,
	COUNT(CASE WHEN respcode = '5' THEN 1 END) AS unable_to_process,
	COUNT(CASE WHEN respcode = '8' THEN 1 END) AS issuer_timeout_8,
	COUNT(CASE WHEN respcode = '9' THEN 1 END) AS issuer_timeout_9,
	COUNT(CASE WHEN respcode = '10' THEN 1 END) AS unable_to_reverse,
	COUNT(CASE WHEN respcode = '14' THEN 1 END) AS invalid_card,
	COUNT(CASE WHEN respcode = '19' THEN 1 END) AS system_error_reenter,
	COUNT(CASE WHEN respcode = '20' THEN 1 END) AS no_from_account,
	COUNT(CASE WHEN respcode = '22' THEN 1 END) AS no_checking_account,
	COUNT(CASE WHEN respcode = '23' THEN 1 END) AS no_saving_account,
	COUNT(CASE WHEN respcode = '30' THEN 1 END) AS format_error,
	COUNT(CASE WHEN respcode = '48' THEN 1 END) AS chip_arqc_failure,
	COUNT(CASE WHEN respcode = '56' THEN 1 END) AS no_card_record,
	COUNT(CASE WHEN respcode = '57' THEN 1 END) AS txn_not_permitted_on_card,
	COUNT(CASE WHEN respcode = '58' THEN 1 END) AS txn_not_permitted_on_terminal,
	COUNT(CASE WHEN respcode = '68' THEN 1 END) AS late_response,
	COUNT(CASE WHEN respcode = '81' THEN 1 END) AS invalid_pin_block,
	COUNT(CASE WHEN respcode = '82' THEN 1 END) AS invalid_cvv,
	COUNT(CASE WHEN respcode = '87' THEN 1 END) AS pin_key_error,
	COUNT(CASE WHEN respcode = '91' THEN 1 END) AS switch_not_available,
	COUNT(CASE WHEN respcode = '92' THEN 1 END) AS invalid_issuer,
	COUNT(CASE WHEN respcode = '93' THEN 1 END) AS invalid_acquirer,
	COUNT(CASE WHEN respcode = '96' THEN 1 END) AS system_error,
	COUNT(CASE WHEN respcode = '99' THEN 1 END) AS duplicate_transaction,
	COUNT(CASE WHEN respcode = '102' THEN 1 END) AS partial_dispense,
	COUNT(CASE WHEN respcode = '103' THEN 1 END) AS unable_to_dispense,
	COUNT(CASE WHEN respcode = '112' THEN 1 END) AS uncertain_dispense,
	COUNT(CASE WHEN respcode = '113' THEN 1 END) AS deposit_error_113,
	COUNT(CASE WHEN respcode = '121' THEN 1 END) AS deposit_error_121,
	COUNT(CASE WHEN respcode = '702' THEN 1 END) AS server_declined,
	COUNT(CASE WHEN respcode = '801' THEN 1 END) AS clarification_two,
	COUNT(CASE WHEN respcode = '802' THEN 1 END) AS invalid_cvv_two,
	COUNT(CASE WHEN respcode = '900' THEN 1 END) AS issuer_down,
	COUNT(CASE WHEN respcode = '903' THEN 1 END) AS rejected_message,
	COUNT(CASE WHEN respcode = '906' THEN 1 END) AS transferee_down,
	COUNT(CASE WHEN respcode = '930' THEN 1 END) AS system_up,
	COUNT(CASE WHEN respcode = '990' THEN 1 END) AS system_error_990,
	COUNT(CASE WHEN respcode = '3' THEN 1 END) AS invalid_merchant,
	COUNT(CASE WHEN respcode = '39' THEN 1 END) AS no_credit_account,
	COUNT(CASE WHEN respcode = '811' THEN 1 END) AS system_security_error,
	COUNT(CASE WHEN respcode NOT IN (` + classifiedRespCodes + `) THEN 1 END) AS others,
	COUNT(*) - COUNT(CASE WHEN respcode IN (` + approvedRespCodes + `) THEN 1 END) AS number_of_declined_txn,
	NVL(
		ROUND(
			(
				COUNT(CASE WHEN respcode IN (` + approvedRespCodes + `) THEN 1 END)
				/ NULLIF(
					COUNT(CASE WHEN respcode IN (` + approvedRespCodes + `) THEN 1 END)
					+ COUNT(CASE WHEN respcode NOT IN (` + approvedRespCodes + `) THEN 1 END),
					0
				)
			) * 100,
			2
		),
		0
	) AS percent_success_rate,
	NVL(SUM(CASE WHEN respcode IN (` + approvedRespCodes + `) THEN amount ELSE 0 END), 0) AS total_approved_amount,
	NVL(SUM(amount), 0) - NVL(SUM(CASE WHEN respcode IN (` + approvedRespCodes + `) THEN amount ELSE 0 END), 0) AS total_declined_amount,
	NVL(SUM(amount), 0) AS total_transaction_amount
FROM oasis.shclog
WHERE merchant_type = '6011'
	AND SUBSTR(termid, 4, 1) IN ('C', 'N')
	AND LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY')
`

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
	DeclinedCount       sql.NullFloat64
	SuccessRatePercent  sql.NullFloat64
	ApprovedAmount      sql.NullFloat64
	DeclinedAmount      sql.NullFloat64
	TotalAmount         sql.NullFloat64
}

func (r *successTransactionRepository) GetReport(ctx context.Context, dateFrom, dateTo string) (*model.SuccessTransactionReport, error) {
	var row successTransactionRow

	err := r.db.QueryRowContext(
		ctx,
		successTransactionQuery,
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
		&row.DeclinedCount,
		&row.SuccessRatePercent,
		&row.ApprovedAmount,
		&row.DeclinedAmount,
		&row.TotalAmount,
	)
	if err != nil {
		return nil, dbrepo.Wrap(common.ErrFailedToFetchReport, err)
	}

	return &model.SuccessTransactionReport{
		DateFrom:           dateFrom,
		DateTo:             dateTo,
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
			reason("other", "Others", row.Others),
		},
	}, nil
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
