package model

type OnusEvent struct {
	ID             string  `json:"id"`
	Time           string  `json:"time"`
	Direction      string  `json:"direction"`
	MTI            string  `json:"mti"`
	ResponseCode   string  `json:"responseCode"`
	Approved       bool    `json:"approved"`
	Terminal       string  `json:"terminal"`
	ProcessingCode string  `json:"processingCode"`
	Type           string  `json:"type"`
	Amount         float64 `json:"amount"`
	MCC            string  `json:"mcc"`
	STAN           string  `json:"stan"`
	RRN            string  `json:"rrn"`
	AuthCode       string  `json:"authCode"`
	Acquirer       string  `json:"acquirer"`
}

type OnusFrame struct {
	Type  string     `json:"type"`
	Live  bool       `json:"live"`
	Error string     `json:"error,omitempty"`
	Event *OnusEvent `json:"event,omitempty"`
}
