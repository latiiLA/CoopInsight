package model

type TerminalPerformanceRow struct {
	Rank              int     `json:"rank"`
	TerminalID        string  `json:"terminalId"`
	TerminalName      string  `json:"terminalName"`
	BranchName        string  `json:"branchName"`
	TransactionCount  int     `json:"transactionCount"`
	ApprovedCount     int     `json:"approvedCount"`
	Amount            float64 `json:"amount"`
	ApprovedAmount    float64 `json:"approvedAmount"`
}

type TerminalPerformanceReport struct {
	Fleet             string                    `json:"fleet"`
	TerminalCount     int                       `json:"terminalCount"`
	ActiveCount       int                       `json:"activeCount"`
	TransactionCount  int                       `json:"transactionCount"`
	TotalAmount       float64                   `json:"totalAmount"`
	Highest           []TerminalPerformanceRow  `json:"highest"`
	Lowest            []TerminalPerformanceRow  `json:"lowest"`
	Rows              []TerminalPerformanceRow  `json:"rows"`
}
