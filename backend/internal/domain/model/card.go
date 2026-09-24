package model

type Card struct {
	CardStatus        string `json:"cardStatus"`
	StatusDescription string `json:"statusDescription"`
	CardCount         int64  `json:"cardCount"`
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
