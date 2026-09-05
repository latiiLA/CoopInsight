package model

type DeclineReason struct {
	Code  string `json:"code"`
	Label string `json:"label"`
	Count int64  `json:"count"`
}

type SuccessTransactionReport struct {
	DateFrom           string          `json:"dateFrom"`
	DateTo             string          `json:"dateTo"`
	TotalTransactions  int64           `json:"totalTransactions"`
	ApprovedCount      int64           `json:"approvedCount"`
	DeclinedCount      int64           `json:"declinedCount"`
	SuccessRatePercent float64         `json:"successRatePercent"`
	ApprovedAmount     float64         `json:"approvedAmount"`
	DeclinedAmount     float64         `json:"declinedAmount"`
	TotalAmount        float64         `json:"totalAmount"`
	DeclineReasons     []DeclineReason `json:"declineReasons"`
}
