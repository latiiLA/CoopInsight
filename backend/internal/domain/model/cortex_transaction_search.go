package model

// CortexTransactionSearchRequest is the Reports Cortex tlog lookup filter.
// Dates are optional only when RRN, Card, STAN, or Log id is set.
type CortexTransactionSearchRequest struct {
	DateFrom string `json:"dateFrom,omitempty"`
	DateTo   string `json:"dateTo,omitempty"`
	Product  string `json:"product,omitempty"`

	Card       string `json:"card,omitempty"`
	Cardholder string `json:"cardholder,omitempty"`
	Branch     string `json:"branch,omitempty"`
	Q          string `json:"q,omitempty"`

	RRN              string   `json:"rrn,omitempty"`
	Merchant         string   `json:"merchant,omitempty"`
	Terminal         string   `json:"terminal,omitempty"`
	TxnCode          string   `json:"txnCode,omitempty"`
	TlogID           *int64   `json:"tlogId,omitempty"`
	STAN             string   `json:"stan,omitempty"`
	Account          string   `json:"account,omitempty"`
	ApprovalCode     string   `json:"approvalCode,omitempty"`
	RspCode          string   `json:"rspCode,omitempty"`
	Currency         string   `json:"currency,omitempty"`
	MCC              string   `json:"mcc,omitempty"`
	AcquiringCountry string   `json:"acquiringCountry,omitempty"`
	Result           string   `json:"result,omitempty"`   // "" | approved | declined
	Reversal         string   `json:"reversal,omitempty"` // "" | exclude | only
	AmountMin        *float64 `json:"amountMin,omitempty"`
	AmountMax        *float64 `json:"amountMax,omitempty"`
}

// CortexTransaction is one cortex.tlog row with card context for Reports search.
type CortexTransaction struct {
	CardID            int64   `json:"cardId"`
	CardMasked        string  `json:"cardMasked"`
	CardholderName    string  `json:"cardholderName,omitempty"`
	ProductCode       string  `json:"productCode"`
	ProductName       string  `json:"productName"`
	StatusCode        string  `json:"statusCode"`
	StatusDescription string  `json:"statusDescription"`
	BranchCode        string  `json:"branchCode"`
	BranchName        string  `json:"branchName"`

	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	AmountTxn    float64 `json:"amountTxn"`
	TxnCurrency  string  `json:"txnCurrency"`
	TxnCode      string  `json:"txnCode"`
	MsgType      string  `json:"msgType"`
	RspCode      string  `json:"rspCode"`
	Approved     bool    `json:"approved"`
	RRN          string  `json:"rrn"`
	TerminalID   string  `json:"terminalId"`
	MerchantName string  `json:"merchantName"`
	MerchantID   string  `json:"merchantId"`
	Date         string  `json:"date"`
	Time         string  `json:"time"`
	TlogID       int64   `json:"tlogId"`
}

// CortexTransactionSearchResult is a single paged search response.
type CortexTransactionSearchResult struct {
	Page     int                 `json:"page"`
	PageSize int                 `json:"pageSize"`
	HasMore  bool                `json:"hasMore"`
	Items    []CortexTransaction `json:"items"`
}

// CortexTransactionDetail is the full switch-log row for Reports drill-down.
// Sensitive track / raw PAN fields are never included.
type CortexTransactionDetail struct {
	TlogID int64 `json:"tlogId"`

	// Card / branch
	CardID            int64  `json:"cardId"`
	CardMasked        string `json:"cardMasked"`
	CardholderName    string `json:"cardholderName,omitempty"`
	ProductCode       string `json:"productCode"`
	ProductName       string `json:"productName"`
	StatusCode        string `json:"statusCode"`
	StatusDescription string `json:"statusDescription"`
	BranchCode        string `json:"branchCode"`
	BranchName        string `json:"branchName"`

	// Identity / timing
	RRN          string `json:"rrn"`
	STAN         string `json:"stan"`
	OriginalSTAN string `json:"originalStan"`
	TRN          string `json:"trn"`
	ARN          string `json:"arn"`
	Date         string `json:"date"`
	Time         string `json:"time"`
	LocalDate    string `json:"localDate"`
	LocalTime    string `json:"localTime"`
	TransmitDate string `json:"transmitDate"`
	TransmitTime string `json:"transmitTime"`
	CreatedAt    string `json:"createdAt"`

	// Message / outcome
	MsgClass        string `json:"msgClass"`
	MsgFunction     string `json:"msgFunction"`
	TxnCode         string `json:"txnCode"`
	SubTxnCode      string `json:"subTxnCode"`
	TxnStatus       string `json:"txnStatus"`
	RspCode         string `json:"rspCode"`
	ActionCode      string `json:"actionCode"`
	ReasonCode      string `json:"reasonCode"`
	ApprovalCode    string `json:"approvalCode"`
	Approved        bool   `json:"approved"`
	RspSource       string `json:"rspSource"`
	StipReason      string `json:"stipReason"`
	RejectReason    string `json:"rejectReason"`
	FunctionCode    string `json:"functionCode"`
	AuthLife        string `json:"authLife"`
	AuthExpiry      string `json:"authExpiry"`
	Scheme          string `json:"scheme"`
	Cleared         string `json:"cleared"`

	// Merchant / terminal
	TerminalID       string `json:"terminalId"`
	TerminalType     string `json:"terminalType"`
	MerchantName     string `json:"merchantName"`
	MerchantID       string `json:"merchantId"`
	MerchantBusiness string `json:"merchantBusiness"`
	MerchantLocName  string `json:"merchantLocName"`
	MerchantStreet   string `json:"merchantStreet"`
	MerchantCity     string `json:"merchantCity"`
	MerchantPostcode string `json:"merchantPostcode"`
	MerchantRegion   string `json:"merchantRegion"`
	MerchantCountry  string `json:"merchantCountry"`
	AcquirerCountry  string `json:"acquirerCountry"`

	// Routing
	TxnSource      string `json:"txnSource"`
	SourceIID      string `json:"sourceIid"`
	SourceCountry  string `json:"sourceCountry"`
	DestIID        string `json:"destIid"`
	DestCountry    string `json:"destCountry"`
	RouteIID       string `json:"routeIid"`
	AcquiringIID   string `json:"acquiringIid"`
	ForwardingIID  string `json:"forwardingIid"`
	ReceivingIID   string `json:"receivingIid"`
	SettlementIID  string `json:"settlementIid"`

	// Amounts
	Amount           float64 `json:"amount"`
	Currency         string  `json:"currency"`
	AmountTxn        float64 `json:"amountTxn"`
	TxnCurrency      string  `json:"txnCurrency"`
	AmountTxnOrg     float64 `json:"amountTxnOrg"`
	AmountCashback   float64 `json:"amountCashback"`
	AmountTxnFee     float64 `json:"amountTxnFee"`
	AmountProcFee    float64 `json:"amountProcFee"`
	AmountTax        float64 `json:"amountTax"`
	AmountCommission float64 `json:"amountCommission"`
	AmountSettlement float64 `json:"amountSettlement"`
	SettlementCurrency string `json:"settlementCurrency"`
	SettlementRate   float64 `json:"settlementRate"`
	BillingRate      float64 `json:"billingRate"`

	// Accounts
	Account1     string `json:"account1"`
	Account1Type string `json:"account1Type"`
	Account2     string `json:"account2"`
	Account2Type string `json:"account2Type"`

	// POS / chip (codes as stored; labels in UI)
	PosCapability string `json:"posCapability"`
	PosEntryMode  string `json:"posEntryMode"`
	CardSeqNo     string `json:"cardSeqNo"`
	ATC           string `json:"atc"`
	ServiceCode   string `json:"serviceCode"`
	ExpiryDate    string `json:"expiryDate"`
}
