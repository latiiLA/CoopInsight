package model

type TerminalTransaction struct {
	RRN              string  `json:"rrn"`
	TerminalID       string  `json:"terminalId"`
	TerminalName     string  `json:"terminalName"`
	TerminalLocation string  `json:"terminalLocation"`
	TxnCode          string  `json:"txnCode"`
	TxnType          string  `json:"txnType"`
	Response         string  `json:"response"`
	Status           string  `json:"status"`
	Date             string  `json:"date"`
	Amount           float64 `json:"amount"`
}
