package model

// SwitchTransactionSearchRequest is the Reports IST shclog lookup filter.
// Dates are optional only when RRN, Card, or Trace is set.
type SwitchTransactionSearchRequest struct {
	DateFrom string `json:"dateFrom,omitempty"`
	DateTo   string `json:"dateTo,omitempty"`
	Product  string `json:"product,omitempty"`

	Card string `json:"card,omitempty"`
	Q    string `json:"q,omitempty"`

	RRN              string   `json:"rrn,omitempty"`
	Merchant         string   `json:"merchant,omitempty"`
	Terminal         string   `json:"terminal,omitempty"`
	TxnCode          string   `json:"txnCode,omitempty"`
	Trace            string   `json:"trace,omitempty"`
	Account          string   `json:"account,omitempty"`
	ApprovalCode     string   `json:"approvalCode,omitempty"`
	RspCode          string   `json:"rspCode,omitempty"`
	IssuerCurrency   string   `json:"issuerCurrency,omitempty"`
	AcquirerCurrency string   `json:"acquirerCurrency,omitempty"`
	MCC              string   `json:"mcc,omitempty"`
	AcquiringCountry string   `json:"acquiringCountry,omitempty"`
	Acquirer         string   `json:"acquirer,omitempty"`
	RouteID          string   `json:"routeId,omitempty"`
	RouteMatch       string   `json:"routeMatch,omitempty"` // source | dest | either
	Channel          string   `json:"channel,omitempty"`    // "" | atm | pos
	MsgType          string   `json:"msgType,omitempty"`
	Result           string   `json:"result,omitempty"`   // "" | approved | declined
	Reversal         string   `json:"reversal,omitempty"` // "" | exclude | only
	AmountMin        *float64 `json:"amountMin,omitempty"`
	AmountMax        *float64 `json:"amountMax,omitempty"`
}

// SwitchTransaction is one oasis.shclog row for Reports search.
type SwitchTransaction struct {
	RowID            string  `json:"rowId"`
	Date             string  `json:"date"`
	Time             string  `json:"time"`
	RRN              string  `json:"rrn"`
	Trace            string  `json:"trace"`
	CardMasked       string  `json:"cardMasked"`
	ProductCode      string  `json:"productCode"`
	TerminalID       string  `json:"terminalId"`
	MerchantName     string  `json:"merchantName"`
	TerminalLocation string  `json:"terminalLocation"`
	Amount           float64 `json:"amount"`
	IssuerCurrency   string  `json:"issuerCurrency"`
	AcquirerCurrency string  `json:"acquirerCurrency"`
	RspCode          string  `json:"rspCode"`
	Approved         bool    `json:"approved"`
	MsgType          string  `json:"msgType"`
	TxnCode          string  `json:"txnCode"`
	Acquirer         string  `json:"acquirer"`
	TxnSrc           string  `json:"txnSrc"`
	TxnDest          string  `json:"txnDest"`
	MCC              string  `json:"mcc"`
}

// SwitchTransactionSearchResult is a single paged search response.
type SwitchTransactionSearchResult struct {
	Page     int                 `json:"page"`
	PageSize int                 `json:"pageSize"`
	HasMore  bool                `json:"hasMore"`
	Items    []SwitchTransaction `json:"items"`
}

// SwitchTransactionDetail is a full IST switch-log row for Reports drill-down.
// Raw PAN is never included.
type SwitchTransactionDetail struct {
	RowID string `json:"rowId"`

	Date      string `json:"date"`
	Time      string `json:"time"`
	TranDate  string `json:"tranDate"`
	TranTime  string `json:"tranTime"`
	SettleDate string `json:"settleDate"`

	RRN          string `json:"rrn"`
	Trace        string `json:"trace"`
	OrigTrace    string `json:"origTrace"`
	AuthNum      string `json:"authNum"`
	TransID      string `json:"transId"`
	InvoiceNumber string `json:"invoiceNumber"`

	CardMasked  string `json:"cardMasked"`
	ProductCode string `json:"productCode"`
	CardSeqNo   string `json:"cardSeqNo"`
	Account     string `json:"account"`

	MsgType        string `json:"msgType"`
	OrigMsgType    string `json:"origMsgType"`
	TxnCode        string `json:"txnCode"`
	TxnType        string `json:"txnType"`
	RspCode        string `json:"rspCode"`
	AlphaRspCode   string `json:"alphaRspCode"`
	ReasonCode     string `json:"reasonCode"`
	RevCode        string `json:"revCode"`
	Approved       bool   `json:"approved"`

	TerminalID       string `json:"terminalId"`
	TerminalLocation string `json:"terminalLocation"`
	MerchantName     string `json:"merchantName"`
	MCC              string `json:"mcc"`
	AcquiringCountry string `json:"acquiringCountry"`
	StoreID          string `json:"storeId"`
	Branch           string `json:"branch"`

	Acquirer string `json:"acquirer"`
	Issuer   string `json:"issuer"`
	TxnSrc   string `json:"txnSrc"`
	TxnDest  string `json:"txnDest"`
	SrcNode  string `json:"srcNode"`
	DestNode string `json:"destNode"`

	Amount           float64 `json:"amount"`
	IssuerCurrency   string  `json:"issuerCurrency"`
	AcquirerCurrency string  `json:"acquirerCurrency"`
	TxnCurrency      string  `json:"txnCurrency"`
	CardholderCurrency string `json:"cardholderCurrency"`
	SettlementCurrency string `json:"settlementCurrency"`
	SettlementAmount float64 `json:"settlementAmount"`
	TxnAmount        float64 `json:"txnAmount"`
	Cashback         float64 `json:"cashback"`
	Fee              float64 `json:"fee"`
	AvailableBalance float64 `json:"availableBalance"`
	LedgerBalance    float64 `json:"ledgerBalance"`

	PosEntryMode string `json:"posEntryMode"`
	PosCondition string `json:"posCondition"`
	DeviceCap    string `json:"deviceCap"`
}
