package model

// Card health bands.
//
// A status is a technical code; what a user actually needs to know is whether a
// card can be used. These bands answer that, and they are the basis for the
// usability summary on the cards-per-status page.
const (
	// CardHealthActive: the card works.
	CardHealthActive = "active"
	// CardHealthNotActive: the card exists but the customer cannot use it yet,
	// because it was never issued, never activated, or could not be produced.
	CardHealthNotActive = "notActive"
	// CardHealthBlocked: the card would work but is currently prevented, by a
	// PIN lockout, a block, or a fraud flag.
	CardHealthBlocked = "blocked"
	// CardHealthDead: the card will never work again, because it was lost,
	// stolen, damaged, expired, cancelled or the account was closed.
	CardHealthDead = "dead"
	// CardHealthOther: a status this build does not classify, so it is counted
	// separately rather than silently folded into a band.
	CardHealthOther = "other"
)

// cardStatusHealth maps CORTEX status codes to health bands.
//
// The bands are derived from what the statuses mean, cross-checked against the
// ACTIONCODE and CANCELED flags in CRDSTATUS. Those flags are close but not
// sufficient on their own, which is why the mapping is explicit:
//
//   - ACTIONCODE groups PENDING_ISSUANCE with PIN TRIES EXCEEDED, so it cannot
//     separate "not usable yet" from "blocked".
//   - CANCELED is set on PENDING_ISSUANCE, which is not a dead end.
//
// ACTIONCODE and CANCELED are still returned with each row so the report shows
// the vendor's own view next to the band, and so this list can be checked
// against the data rather than taken on trust.
var cardStatusHealth = map[string]string{
	// Working.
	"00": CardHealthActive,
	"33": CardHealthActive, // VIP

	// Not usable yet: never produced, never issued, or never activated.
	"02": CardHealthNotActive, // NOT YET ISSUED
	"19": CardHealthNotActive, // PENDING_INS_ISSUANCE
	"20": CardHealthNotActive, // PENDING_ISSUANCE
	"23": CardHealthNotActive, // FAILED PRINTING BULK
	"30": CardHealthNotActive, // PENDING_ACTIVATION
	"22": CardHealthNotActive, // EXTRACTION_FAILED
	"99": CardHealthNotActive, // new

	// Usable but currently prevented.
	"01": CardHealthBlocked, // PIN TRIES EXCEEDED
	"50": CardHealthBlocked, // Safe Block
	"51": CardHealthBlocked, // Temporary Block
	"08": CardHealthBlocked, // FRAUD

	// Permanently unusable.
	"03": CardHealthDead, // CARD EXPIRED
	"04": CardHealthDead, // LOST
	"05": CardHealthDead, // STOLEN
	"06": CardHealthDead, // CUSTOMER CLOSE
	"07": CardHealthDead, // BANK CANCELLED
	"09": CardHealthDead, // DAMAGED
	"52": CardHealthDead, // Not Sold
}

// CardHealth classifies a CORTEX status code. Unknown codes return
// CardHealthOther so a newly configured status shows up as unclassified rather
// than being absorbed into a band.
func CardHealth(statusCode string) string {
	if band, ok := cardStatusHealth[statusCode]; ok {
		return band
	}
	return CardHealthOther
}

// Card is one row of the cards-per-status report.
//
// The dimension fields are populated only when the caller grouped by them, so
// they are omitted from the response rather than sent as empty strings.
type Card struct {
	CardStatus        string `json:"cardStatus"`
	StatusDescription string `json:"statusDescription"`

	// Vendor flags from CRDSTATUS, shown next to the derived health band.
	ActionCode string `json:"actionCode"`
	Canceled   string `json:"canceled"`
	// Health is one of the CardHealth* bands.
	Health string `json:"health"`

	ProductCode string `json:"productCode,omitempty"`
	ProductName string `json:"productName,omitempty"`
	BranchCode  string `json:"branchCode,omitempty"`
	BranchName  string `json:"branchName,omitempty"`

	CardCount int64 `json:"cardCount"`

	// Ageing in days from the date the report is bucketed on, which is
	// DATE_CREATED or DATE_STATCHG depending on the dateField filter.
	//
	// DATE_STATCHG is populated for every card, so these four sum to CardCount.
	// If that ever stops being true the buckets will sum to less, which is
	// visible rather than hidden.
	Age0To7   int64 `json:"age0to7"`
	Age8To30  int64 `json:"age8to30"`
	Age31To90 int64 `json:"age31to90"`
	Age91Plus int64 `json:"age91plus"`

	// ExpiringCount is how many cards in the group expire within the report's
	// expiry window. The window is a report-level setting, echoed alongside the
	// rows, not repeated per row.
	ExpiringCount int64 `json:"expiringCount"`
}

// CardDailyActivity holds the per-day counts for a single calendar date.
type CardDailyActivity struct {
	Date      string `json:"date"` // yyyy-MM-dd
	Created   int64  `json:"created"`
	Issued    int64  `json:"issued"`
	Activated int64  `json:"activated"`
}

type CardActivityTotals struct {
	Created   int64 `json:"created"`
	Issued    int64 `json:"issued"`
	Activated int64 `json:"activated"`
}

// CardActivityReport is the daily created/issued/activated series plus totals
// for the requested date range.
type CardActivityReport struct {
	From   string              `json:"from"` // yyyy-MM-dd
	To     string              `json:"to"`   // yyyy-MM-dd
	Totals CardActivityTotals  `json:"totals"`
	Daily  []CardDailyActivity `json:"daily"`
}

// CardBranchActivity is the created/issued/activated totals for one branch
// within the requested date range.
type CardBranchActivity struct {
	BranchID   int64  `json:"branchId"`
	BranchCode string `json:"branchCode"`
	BranchName string `json:"branchName"`
	Created    int64  `json:"created"`
	Issued     int64  `json:"issued"`
	Activated  int64  `json:"activated"`
}

// Total is the sum of the three activity counts, used for ranking.
func (b CardBranchActivity) Total() int64 {
	return b.Created + b.Issued + b.Activated
}

// Card metrics that a detail list can be filtered by. Each maps to a different
// date column, and therefore a different source table, in Oracle.
const (
	CardMetricCreated   = "created"
	CardMetricIssued    = "issued"
	CardMetricActivated = "activated"
)

// CardDetail is one individual card behind an activity count.
//
// This is PII-bearing, so the type is deliberately narrow. The card number
// arrives already masked from SQL, and PCI columns (CVV, CVC, PVV, PVKI,
// PINSMADE) and DATE_BIRTH are never selected. CardholderName is populated only
// when the caller holds the cardholder-name permission.
//
// All dates are preformatted strings rather than time.Time: the Oracle driver
// returns them with a +03:00 session offset, which shifts the calendar day
// depending on how Go marshals it.
type CardDetail struct {
	CardID            int64  `json:"cardId"`
	CardMasked        string `json:"cardMasked"`
	CardholderName    string `json:"cardholderName,omitempty"`
	SeqNo             int64  `json:"seqNo"`
	ProductCode       string `json:"productCode"`
	ProductName       string `json:"productName"`
	StatusCode        string `json:"statusCode"`
	StatusDescription string `json:"statusDescription"`
	BranchCode        string `json:"branchCode"`
	BranchName        string `json:"branchName"`
	EffectiveDate     string `json:"effectiveDate"`
	ExpiryDate        string `json:"expiryDate"`
	CreatedAt         string `json:"createdAt"`
	IssuedAt          string `json:"issuedAt"`
	ActivatedAt       string `json:"activatedAt"`
}
