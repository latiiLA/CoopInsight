package model

type DeclineReason struct {
	Code  string `json:"code"`
	Label string `json:"label"`
	Count int64  `json:"count"`
}

// SuccessTransactionReport is one channel+flow slice (onus, offus, issuing, or acquiring).
type SuccessTransactionReport struct {
	DateFrom           string          `json:"dateFrom"`
	DateTo             string          `json:"dateTo"`
	Channel            string          `json:"channel"`
	Flow               string          `json:"flow"`
	TotalTransactions  int64           `json:"totalTransactions"`
	ApprovedCount      int64           `json:"approvedCount"`
	DeclinedCount      int64           `json:"declinedCount"`
	SuccessRatePercent float64         `json:"successRatePercent"`
	ApprovedAmount     float64         `json:"approvedAmount"`
	DeclinedAmount     float64         `json:"declinedAmount"`
	TotalAmount        float64         `json:"totalAmount"`
	DeclineReasons     []DeclineReason `json:"declineReasons"`
}

// SuccessRateTrendPoint is one time-bucket of success-rate metrics.
type SuccessRateTrendPoint struct {
	PeriodStart        string  `json:"periodStart"`
	PeriodLabel        string  `json:"periodLabel"`
	TotalTransactions  int64   `json:"totalTransactions"`
	ApprovedCount      int64   `json:"approvedCount"`
	DeclinedCount      int64   `json:"declinedCount"`
	SuccessRatePercent float64 `json:"successRatePercent"`
	ApprovedAmount     float64 `json:"approvedAmount"`
	DeclinedAmount     float64 `json:"declinedAmount"`
	TotalAmount        float64 `json:"totalAmount"`
}

// SuccessRateTrendReport is a channel+flow time series of success rates.
type SuccessRateTrendReport struct {
	DateFrom    string                  `json:"dateFrom"`
	DateTo      string                  `json:"dateTo"`
	Channel     string                  `json:"channel"`
	Flow        string                  `json:"flow"`
	Granularity string                  `json:"granularity"`
	Points      []SuccessRateTrendPoint `json:"points"`
}

// SuccessTransactionDetail is one shclog authorization row for browse/drill-down.
type SuccessTransactionDetail struct {
	ID                string  `json:"id"`
	TxnAt             string  `json:"txnAt"`
	MsgType           int64   `json:"msgType"`
	TerminalID        string  `json:"terminalId"`
	TerminalLocation  string  `json:"terminalLocation"`
	CardMasked        string  `json:"cardMasked"`
	CardProduct       string  `json:"cardProduct"`
	RespCode          string  `json:"respCode"`
	RespLabel         string  `json:"respLabel"`
	Outcome           string  `json:"outcome"` // approved | declined | reversed
	Amount            float64 `json:"amount"`
	RefNum            string  `json:"refNum"`
	Acquirer          string  `json:"acquirer"`
	TxnSrc            string  `json:"txnSrc"`
	TxnDest           string  `json:"txnDest"`
	MerchantType      int64   `json:"merchantType"`
}
