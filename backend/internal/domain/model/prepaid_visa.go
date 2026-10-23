package model

// PrepaidVisaDashboard is the KPI snapshot for international prepaid Visa
// products 401 (Platinum) and 402 (Classic) over a date range.
//
// Money amounts that compare to the card wallet use billing currency
// (AMTBILL / CURBILL, typically USD 840) — not mixed foreign AMTTXN.
type PrepaidVisaDashboard struct {
	DateFrom string `json:"dateFrom"`
	DateTo   string `json:"dateTo"`

	// Fleet is current portfolio size / balances (not date-ranged).
	// Available balance = accdet.AVLBAL.
	// Available amount (spendable) = AVLBAL + SHDWAUTHOV − BLKAMT + UNCLRCREDIT.
	// Blocked = accdet.BLKAMT.
	// From available = −Σ accitems.AMTAVL (ledger “from available” total; not CLRBAL).
	FleetCards           int     `json:"fleetCards"`
	FleetAvailableBal    float64 `json:"fleetAvailableBal"`
	FleetAvailableAmount float64 `json:"fleetAvailableAmount"`
	FleetBlockedBal      float64 `json:"fleetBlockedBal"`
	FleetFromAvailable   float64 `json:"fleetFromAvailable"`
	// FleetUnloaded is lifetime account unloads (wrong-load corrections that zero the card).
	FleetUnloaded      float64 `json:"fleetUnloaded"`
	FleetUnloadCount   int     `json:"fleetUnloadCount"`
	// FleetTopUpAmount / FleetTopUpCount are lifetime loads (not date-ranged).
	FleetTopUpAmount float64 `json:"fleetTopUpAmount"`
	FleetTopUpCount  int     `json:"fleetTopUpCount"`
	// FleetApprovedAmount is lifetime approved spend (signed; reversals net out).
	FleetApprovedAmount float64 `json:"fleetApprovedAmount"`
	// AmtBlockedSum is Σ accitems.AMTBLK (should track FleetBlockedBal).
	AmtBlockedSum float64 `json:"amtBlockedSum"`
	// BlockedPlusFromAvailable = FleetBlockedBal + FleetFromAvailable.
	BlockedPlusFromAvailable float64 `json:"blockedPlusFromAvailable"`
	// ReconcileExpected = availableAmount + blocked + fromAvailable + unloaded.
	ReconcileExpected float64 `json:"reconcileExpected"`
	BlockedCards      int     `json:"blockedCards"`
	FleetCurrency     string  `json:"fleetCurrency"`

	TopUpCount   int     `json:"topUpCount"`
	TopUpAmount  float64 `json:"topUpAmount"`
	TopUpCards   int     `json:"topUpCards"`
	AvgTopUp     float64 `json:"avgTopUp"`
	LargestTopUp float64 `json:"largestTopUp"`

	UnloadCount  int     `json:"unloadCount"`
	UnloadAmount float64 `json:"unloadAmount"`
	UnloadCards  int     `json:"unloadCards"`

	TxnCount       int     `json:"txnCount"`
	TxnAmount      float64 `json:"txnAmount"` // requested spend — Σ tlog.AMTBILL
	ApprovedAmount float64 `json:"approvedAmount"`
	ActiveCards    int     `json:"activeCards"`
	ApprovedCount  int     `json:"approvedCount"`
	DeclinedCount  int     `json:"declinedCount"`
	ApprovalRate   float64 `json:"approvalRate"`
	AvgTxn         float64 `json:"avgTxn"`

	ByProduct    []PrepaidVisaProductBreakdown `json:"byProduct"`
	Daily        []PrepaidVisaDailyPoint       `json:"daily"`
	TopMerchants []PrepaidVisaMerchantSpend    `json:"topMerchants"`
}

// PrepaidVisaProductBreakdown splits dashboard totals by CRDPRODUCT code.
type PrepaidVisaProductBreakdown struct {
	ProductCode      string  `json:"productCode"`
	ProductName      string  `json:"productName"`
	FleetCards       int     `json:"fleetCards"`
	AvailableBal     float64 `json:"availableBal"`
	AvailableAmount  float64 `json:"availableAmount"`
	BlockedBal       float64 `json:"blockedBal"`
	FromAvailable    float64 `json:"fromAvailable"`
	Unloaded         float64 `json:"unloaded"`
	BlockedCards     int     `json:"blockedCards"`
	TopUpCount       int     `json:"topUpCount"`
	TopUpAmount      float64 `json:"topUpAmount"`
	UnloadCount      int     `json:"unloadCount"`
	UnloadAmount     float64 `json:"unloadAmount"`
	TxnCount         int     `json:"txnCount"`
	TxnAmount        float64 `json:"txnAmount"`
	ApprovedAmount   float64 `json:"approvedAmount"`
	ActiveCards      int     `json:"activeCards"`
}

// PrepaidVisaCardReconcile is one wallet checked against:
// Top-up = Available Amount + Blocked + From Available + Unloaded
// where Available Amount = Available Balance + Override − Blocked + Unclear Credit
// From Available = −Σ non-unload AMTAVL, Unloaded = −Σ unload AMTAVL.
//
// Rows are one per wallet account. When several cards share an account, top-ups,
// from-available, and unloads are rolled up across those cards and LinkedCards > 1.
type PrepaidVisaCardReconcile struct {
	CardID            int64   `json:"cardId"`
	CardMasked        string  `json:"cardMasked"`
	CardholderName    string  `json:"cardholderName,omitempty"`
	ProductCode       string  `json:"productCode"`
	ProductName       string  `json:"productName"`
	StatusCode        string  `json:"statusCode"`
	StatusDescription string  `json:"statusDescription"`
	BranchCode        string  `json:"branchCode"`
	BranchName        string  `json:"branchName"`

	AvailableBalance float64 `json:"availableBalance"`
	OverrideAmount   float64 `json:"overrideAmount"`
	BlockedBalance   float64 `json:"blockedBalance"`
	UnclearCredit    float64 `json:"unclearCredit"`
	AvailableAmount  float64 `json:"availableAmount"`
	FromAvailable    float64 `json:"fromAvailable"`
	Unloaded         float64 `json:"unloaded"`

	TopUpAmount float64 `json:"topUpAmount"` // lifetime loads (all cards on wallet)
	// LinkedCards is how many prepaid cards share this wallet (1 = sole card).
	LinkedCards int `json:"linkedCards,omitempty"`
	// Expected = AvailableAmount + Blocked + FromAvailable + Unloaded
	Expected float64 `json:"expected"`
	Variance float64 `json:"variance"` // TopUpAmount - Expected
	Matched  bool    `json:"matched"`
}

// PrepaidVisaReconcileReport is the per-card reconciliation result set.
type PrepaidVisaReconcileReport struct {
	CardCount      int                       `json:"cardCount"`
	MatchedCount   int                       `json:"matchedCount"`
	MismatchCount  int                       `json:"mismatchCount"`
	FundedCount    int                       `json:"fundedCount"`
	FundedMatched  int                       `json:"fundedMatched"`
	MatchTolerance float64                   `json:"matchTolerance"`
	TotalTopUp     float64                   `json:"totalTopUp"`
	TotalUnloaded  float64                   `json:"totalUnloaded"`
	TotalExpected  float64                   `json:"totalExpected"`
	TotalVariance  float64                   `json:"totalVariance"`
	Cards          []PrepaidVisaCardReconcile `json:"cards"`
}

// PrepaidVisaLedgerItem is one account posting that moves available/blocked.
type PrepaidVisaLedgerItem struct {
	AccItemID       int64   `json:"accItemId"`
	CardID          int64   `json:"cardId,omitempty"`
	CardMasked      string  `json:"cardMasked,omitempty"`
	Date            string  `json:"date"`
	Time            string  `json:"time"`
	Kind            string  `json:"kind"` // top-up | unload | spend | reversal | other
	Description     string  `json:"description"`
	Amount          float64 `json:"amount"`
	AvailableDelta  float64 `json:"availableDelta"`
	BlockedDelta    float64 `json:"blockedDelta"`
	AvailableAfter  float64 `json:"availableAfter"`
	BlockedAfter    float64 `json:"blockedAfter"`
}

// PrepaidVisaCardActivity is drill-down detail for one prepaid card / wallet.
// List sections are paginated; *HasMore means more rows exist beyond this page.
type PrepaidVisaCardActivity struct {
	Card                PrepaidVisaCardReconcile `json:"card"`
	TopUps              []PrepaidVisaTopUp       `json:"topUps"`
	TopUpsHasMore       bool                     `json:"topUpsHasMore"`
	Unloads             []PrepaidVisaUnload      `json:"unloads"`
	UnloadsHasMore      bool                     `json:"unloadsHasMore"`
	Transactions        []PrepaidVisaTransaction `json:"transactions"`
	TransactionsHasMore bool                     `json:"transactionsHasMore"`
	Ledger              []PrepaidVisaLedgerItem  `json:"ledger"`
	LedgerHasMore       bool                     `json:"ledgerHasMore"`
}

// PrepaidVisaDailyPoint is one calendar day of top-up and spend activity.
type PrepaidVisaDailyPoint struct {
	Date           string  `json:"date"`
	TopUpCount     int     `json:"topUpCount"`
	TopUpAmount    float64 `json:"topUpAmount"`
	TxnCount       int     `json:"txnCount"`
	TxnAmount      float64 `json:"txnAmount"`
	ApprovedAmount float64 `json:"approvedAmount"`
	ActiveCards    int     `json:"activeCards"`
}

// PrepaidVisaMerchantSpend ranks merchant locations by approved spend.
type PrepaidVisaMerchantSpend struct {
	Merchant    string  `json:"merchant"`
	TxnCount    int     `json:"txnCount"`
	TxnAmount   float64 `json:"txnAmount"`
	ApprovedAmt float64 `json:"approvedAmt"`
}

// PrepaidVisaListFilter is the date + product scope for browse list endpoints.
type PrepaidVisaListFilter struct {
	DateFrom string `json:"dateFrom,omitempty"`
	DateTo   string `json:"dateTo,omitempty"`
	Product  string `json:"product,omitempty"`
}

// PrepaidVisaSearchKind selects which Cortex source a dedicated search hits.
const (
	PrepaidVisaSearchKindTransactions = "transactions"
	PrepaidVisaSearchKindTopUps       = "topups"
	PrepaidVisaSearchKindUnloads      = "unloads"
)

// PrepaidVisaSearchRequest is the dedicated lookup filter (one kind per call).
// Dates are optional only when RRN or Card is set; otherwise required.
type PrepaidVisaSearchRequest struct {
	Kind     string `json:"kind"`
	DateFrom string `json:"dateFrom,omitempty"`
	DateTo   string `json:"dateTo,omitempty"`
	Product  string `json:"product,omitempty"`

	Card       string `json:"card,omitempty"`
	Cardholder string `json:"cardholder,omitempty"`
	Branch     string `json:"branch,omitempty"`
	Q          string `json:"q,omitempty"`

	// Transactions only.
	RRN      string   `json:"rrn,omitempty"`
	Merchant string   `json:"merchant,omitempty"`
	Terminal string   `json:"terminal,omitempty"`
	Result   string   `json:"result,omitempty"`   // "" | approved | declined
	Reversal string   `json:"reversal,omitempty"` // "" | exclude | only
	AmountMin *float64 `json:"amountMin,omitempty"`
	AmountMax *float64 `json:"amountMax,omitempty"`

	// Top-ups / unloads only.
	Account     string `json:"account,omitempty"`
	Description string `json:"description,omitempty"`
}

// PrepaidVisaSearchResult returns one kind of rows (others empty).
type PrepaidVisaSearchResult struct {
	Kind         string                    `json:"kind"`
	Page         int                       `json:"page"`
	PageSize     int                       `json:"pageSize"`
	HasMore      bool                      `json:"hasMore"`
	Transactions []PrepaidVisaTransaction  `json:"transactions,omitempty"`
	TopUps       []PrepaidVisaTopUp        `json:"topUps,omitempty"`
	Unloads      []PrepaidVisaUnload       `json:"unloads,omitempty"`
}

// PrepaidVisaUnload is one account unload (wrong-load correction that zeroes funds).
// Same card context shape as a top-up row for list/detail UI.
type PrepaidVisaUnload struct {
	CardID            int64   `json:"cardId"`
	CardMasked        string  `json:"cardMasked"`
	CardholderName    string  `json:"cardholderName,omitempty"`
	ProductCode       string  `json:"productCode"`
	ProductName       string  `json:"productName"`
	StatusCode        string  `json:"statusCode"`
	StatusDescription string  `json:"statusDescription"`
	BranchCode        string  `json:"branchCode"`
	BranchName        string  `json:"branchName"`
	AvailableBalance  float64 `json:"availableBalance"`
	AvailableAmount   float64 `json:"availableAmount"`
	BlockedBalance    float64 `json:"blockedBalance"`
	FromAvailable     float64 `json:"fromAvailable"`
	Unloaded          float64 `json:"unloaded"`
	AccountCurrency   string  `json:"accountCurrency"`
	AccountNumber     string  `json:"accountNumber"`

	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Description string  `json:"description"`
	TxnCode     string  `json:"txnCode"`
	Date        string  `json:"date"`
	Time        string  `json:"time"`
	TlogID      *int64  `json:"tlogId,omitempty"`
	AccItemID   int64   `json:"accItemId"`
}

// PrepaidVisaTopUp is one ledger load (LOADTYPE/LOADSRC = 50) with card context.
type PrepaidVisaTopUp struct {
	CardID            int64   `json:"cardId"`
	CardMasked        string  `json:"cardMasked"`
	CustomerID        string  `json:"customerId"`
	CardholderName    string  `json:"cardholderName,omitempty"`
	ProductCode       string  `json:"productCode"`
	ProductName       string  `json:"productName"`
	StatusCode        string  `json:"statusCode"`
	StatusDescription string  `json:"statusDescription"`
	BranchCode        string  `json:"branchCode"`
	BranchName        string  `json:"branchName"`
	AvailableBalance float64 `json:"availableBalance"`
	AvailableAmount  float64 `json:"availableAmount"`
	BlockedBalance   float64 `json:"blockedBalance"`
	FromAvailable    float64 `json:"fromAvailable"`
	AccountCurrency  string  `json:"accountCurrency"`
	AccountNumber    string  `json:"accountNumber"`

	Amount      float64 `json:"amount"` // AMTBILL (wallet)
	Currency    string  `json:"currency"`
	Description string  `json:"description"`
	TxnCode     string  `json:"txnCode"`
	Date        string  `json:"date"`
	Time        string  `json:"time"`
	TlogID      *int64  `json:"tlogId,omitempty"`
	AccItemID   int64   `json:"accItemId"`
}

// PrepaidVisaTransaction is one switch log row for a prepaid Visa card.
type PrepaidVisaTransaction struct {
	CardID            int64   `json:"cardId"`
	CardMasked        string  `json:"cardMasked"`
	CardholderName    string  `json:"cardholderName,omitempty"`
	ProductCode       string  `json:"productCode"`
	ProductName       string  `json:"productName"`
	StatusCode        string  `json:"statusCode"`
	StatusDescription string  `json:"statusDescription"`
	BranchCode        string  `json:"branchCode"`
	BranchName        string  `json:"branchName"`
	AvailableBalance float64 `json:"availableBalance"`
	AvailableAmount  float64 `json:"availableAmount"`
	BlockedBalance   float64 `json:"blockedBalance"`
	FromAvailable    float64 `json:"fromAvailable"`
	AccountCurrency  string  `json:"accountCurrency"`

	Amount       float64 `json:"amount"`      // AMTBILL — wallet / billing currency
	Currency     string  `json:"currency"`    // CURBILL
	AmountTxn    float64 `json:"amountTxn"`   // AMTTXN — original txn currency
	TxnCurrency  string  `json:"txnCurrency"` // CURTXN
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
