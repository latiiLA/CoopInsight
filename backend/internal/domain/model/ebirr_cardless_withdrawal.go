package model

type EbirrCardlessWithdrawal struct {
	RRN              string  `json:"rrn"`
	TerminalName     string  `json:"terminalName"`
	TerminalLocation string  `json:"terminalLocation"`
	TerminalID       string  `json:"terminalId"`
	AccountNumber    string  `json:"accountNumber"`
	Response         string  `json:"response"`
	Date             string  `json:"date"`
	Amount           float64 `json:"amount"`
	CustomerMobile   string  `json:"customerMobile"`
	ExtTxnID         string  `json:"extTxnId"`
	BankTransferID   string  `json:"bankTransferId"`
}
