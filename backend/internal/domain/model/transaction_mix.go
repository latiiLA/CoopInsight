package model

// Transaction mix keys. These are the three independent axes the report
// breaks the same population of switch messages down by, so each one sums to
// 100% on its own but they must never be added together.
const (
	// Scheme is the card or scheme carried by the message (SHCLOG.CARDPRODUCT).
	MixAxisScheme = "scheme"
	// Routing is where the message was sent (SHCLOG.TXNDEST).
	MixAxisRouting = "routing"
	// Type is the message type bucketed (SHCLOG.MSGTYPE).
	MixAxisType = "type"
)

// Transaction type buckets derived from SHCLOG.MSGTYPE.
const (
	MixTypeAuthorisation = "authorisation"
	MixTypeReversal      = "reversal"
	MixTypeNetwork       = "network"
	MixTypeOther         = "other"
)

// TransactionMixSlice is one bucket of a single mix axis.
type TransactionMixSlice struct {
	Key           string  `json:"key"`
	Label         string  `json:"label"`
	Count         int64   `json:"count"`
	CountPercent  float64 `json:"countPercent"`
	Amount        float64 `json:"amount"`
	AmountPercent float64 `json:"amountPercent"`
}

// TransactionMixSegment is a slice that also carries its reversal exposure,
// which is the question the scheme and routing breakdowns exist to answer.
type TransactionMixSegment struct {
	TransactionMixSlice
	ReversalCount   int64   `json:"reversalCount"`
	ReversalPercent float64 `json:"reversalPercent"`
}

// TransactionMixReport is the switch message mix over one date range.
//
// Scheme and routing are deliberately separate slices. A message has exactly
// one card scheme and exactly one destination, so a single flat list mixing
// "ETH", "Visa" and "CBO" would double count: an ETH card is still routed
// somewhere, and the same scheme appears under several destinations.
type TransactionMixReport struct {
	DateFrom    string  `json:"dateFrom"`
	DateTo      string  `json:"dateTo"`
	Channel     string  `json:"channel"`
	TotalCount  int64   `json:"totalCount"`
	TotalAmount float64 `json:"totalAmount"`
	// AuthorisationCount and ReversalCount are the two headline figures pulled
	// out of the type axis, repeated here so a caller does not have to sum it.
	AuthorisationCount int64                   `json:"authorisationCount"`
	ReversalCount      int64                   `json:"reversalCount"`
	ReversalPercent    float64                 `json:"reversalPercent"`
	ApprovedCount      int64                   `json:"approvedCount"`
	ByScheme           []TransactionMixSegment `json:"byScheme"`
	ByRouting          []TransactionMixSegment `json:"byRouting"`
	ByType             []TransactionMixSlice   `json:"byType"`
}
