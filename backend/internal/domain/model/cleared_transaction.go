package model

type ClearedTransaction struct {
	ID             int64   `json:"id"`
	Date           string  `json:"date"`
	Time           string  `json:"time"`
	MsgType        int64   `json:"msgType"`
	ProcCode       int64   `json:"procCode"`
	RRN            string  `json:"rrn"`
	STAN           string  `json:"stan"`
	RespCode       string  `json:"respCode"`
	Amount         float64 `json:"amount"`
	Currency       int64   `json:"currency"`
	TerminalID     string  `json:"terminalId"`
	Merchant       string  `json:"merchant"`
	CardProduct    string  `json:"cardProduct"`
	TxnSource      string  `json:"txnSource"`
	TxnDest        string  `json:"txnDest"`
	IssuerAcquirer string  `json:"issuerAcquirer"`
	PosAtm         string  `json:"posAtm"`
}
