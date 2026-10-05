package model

type UnsettledTransaction struct {
	ID             int64   `json:"id"`
	Date           string  `json:"date"`
	TxnDate        string  `json:"txnDate"`
	Time           string  `json:"time"`
	MsgType        int64   `json:"msgType"`
	ProcCode       int64   `json:"procCode"`
	RRN            string  `json:"rrn"`
	STAN           string  `json:"stan"`
	RespCode       string  `json:"respCode"`
	Amount         float64 `json:"amount"`
	Currency       int64   `json:"currency"`
	TerminalID     string  `json:"terminalId"`
	Merchant       string  `json:"merchant"`
	CardProduct    string  `json:"cardProduct"`
	TxnSource      string  `json:"txnSource"`
	TxnDest        string  `json:"txnDest"`
	IssuerAcquirer string  `json:"issuerAcquirer"`
	PosAtm         string  `json:"posAtm"`
	TxnID          string  `json:"txnId"`

	// Mastercard IPM nearest-day amount match (populated for MDS unsettled only).
	// MatchStatus is "matched" when a nearby settlement total covers this amount,
	// or "unmatched" / "missing" when no settlement total matches within the window.
	MatchStatus           string  `json:"matchStatus,omitempty"`
	MatchedSettlementDate string  `json:"matchedSettlementDate,omitempty"`
	// MatchedAmount is the settlement slot amount that matched: equal to this
	// txn for a 1:1 match, or the subset settlement total for a sum match.
	MatchedAmount       float64 `json:"matchedAmount,omitempty"`
	MatchedAmountField  string  `json:"matchedAmountField,omitempty"`
	MatchedFunctionCode string  `json:"matchedFunctionCode,omitempty"`
	MatchedFileID       string  `json:"matchedFileId,omitempty"`
	// MatchMode is "amount" (1:1) or "sum" (subset of clearing rows).
	MatchMode string `json:"matchMode,omitempty"`
	// MatchedClearingAmount is abs(txn amount) — useful on sum-matched rows
	// where MatchedAmount is the larger settlement total.
	MatchedClearingAmount float64 `json:"matchedClearingAmount,omitempty"`
	// FinancialPositionTotal is the related function-685 credits/net/debits
	// total for the same file/day/currency when a 685 row is available.
	FinancialPositionTotal float64 `json:"financialPositionTotal,omitempty"`
	FinancialPositionField string  `json:"financialPositionField,omitempty"`
	MatchNote              string  `json:"matchNote,omitempty"`
}