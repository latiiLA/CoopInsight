package model

// TerminalReconExportRequest is the Reports terminal reconciliation export filter.
// Dates are required; range must be at most 30 inclusive days.
// Only approved transactions are exported.
type TerminalReconExportRequest struct {
	Source   string `json:"source"` // cortex | switch
	DateFrom string `json:"dateFrom"`
	DateTo   string `json:"dateTo"`
	Terminal string `json:"terminal,omitempty"`
	Format   string `json:"format"` // csv | xlsx
}

// TerminalReconChunkRequest is one paged day (or same-day) fetch for progressive export.
// DateFrom and DateTo must be the same calendar day after normalization.
type TerminalReconChunkRequest struct {
	Source   string `json:"source"`
	DateFrom string `json:"dateFrom"`
	DateTo   string `json:"dateTo"`
	Terminal string `json:"terminal,omitempty"`
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
}

// TerminalReconChunkResult is one page of recon rows for client-side file assembly.
type TerminalReconChunkResult struct {
	Headers  []string   `json:"headers"`
	Rows     [][]string `json:"rows"`
	Page     int        `json:"page"`
	PageSize int        `json:"pageSize"`
	HasMore  bool       `json:"hasMore"`
}

const (
	TerminalReconSourceCortex = "cortex"
	TerminalReconSourceSwitch = "switch"
	TerminalReconFormatCSV    = "csv"
	TerminalReconFormatXLSX   = "xlsx"
)
