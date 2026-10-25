package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	EJAtmTypeCRM = "CRM"
	EJAtmTypeNCR = "NCR"
)

// EJFile is one indexed EJ log file registry row (incremental skip by mtime/size).
type EJFile struct {
	ID         primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	TerminalID string             `json:"terminalId" bson:"terminal_id"`
	Filename   string             `json:"filename" bson:"filename"`
	Path       string             `json:"path" bson:"path"`
	MTime      time.Time          `json:"mtime" bson:"mtime"`
	Size       int64              `json:"size" bson:"size"`
	// ParsedOffset is the byte position after the last fully consumed TRANSACTION END.
	// Today's growing files resume from here instead of re-parsing the whole day.
	ParsedOffset int64 `json:"parsedOffset" bson:"parsed_offset"`
	// LinesBefore is the newline count in [0, ParsedOffset) for absolute line numbers.
	LinesBefore int `json:"linesBefore" bson:"lines_before"`
	// SchemaVersion bumps force a one-time full reparse (e.g. NCR newline/status fixes).
	SchemaVersion int       `json:"schemaVersion" bson:"schema_version"`
	AtmType       string    `json:"atmType" bson:"atm_type"`
	TxnCount      int       `json:"txnCount" bson:"txn_count"`
	IndexedAt     time.Time `json:"indexedAt" bson:"indexed_at"`
}

// EJTransaction is one searchable EJ journal row (no full PAN).
type EJTransaction struct {
	ID         primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	TerminalID string             `json:"terminalId" bson:"terminal_id"`
	Filename   string             `json:"filename" bson:"filename"`
	Path       string             `json:"path,omitempty" bson:"path,omitempty"`
	EJDate     string             `json:"ejDate" bson:"ej_date"` // YYYY-MM-DD
	CardFirst4 string             `json:"cardFirst4" bson:"card_first4"`
	CardLast4  string             `json:"cardLast4" bson:"card_last4"`
	CardMasked string             `json:"cardMasked" bson:"card_masked"`
	Amount     float64            `json:"amount" bson:"amount"`
	AuthNum    string             `json:"authNum" bson:"authnum"`
	RespCode   string             `json:"respCode" bson:"respcode"`
	Status     string             `json:"status" bson:"status"`
	StartTime  string             `json:"startTime" bson:"start_time"`
	EndTime    string             `json:"endTime" bson:"end_time"`
	TxnType    string             `json:"txnType" bson:"txn_type"`
	AtmType    string             `json:"atmType" bson:"atm_type"`
	// CustomerAccount is the value after CUSTOMER INFORMATION ENTERED (CRM).
	CustomerAccount string `json:"customerAccount,omitempty" bson:"customer_account,omitempty"`
	// CameraImages are JPG names logged as CAMERA N <file>.JPG in the journal block.
	CameraImages []EJCameraImage `json:"cameraImages,omitempty" bson:"camera_images,omitempty"`
	// Locate-in-journal helpers for operators opening the EJ file.
	FileOffset int64     `json:"fileOffset,omitempty" bson:"file_offset,omitempty"`
	LineStart  int       `json:"lineStart,omitempty" bson:"line_start,omitempty"`
	LineEnd    int       `json:"lineEnd,omitempty" bson:"line_end,omitempty"`
	RawText    string    `json:"rawText,omitempty" bson:"raw_text,omitempty"`
	IndexedAt  time.Time `json:"indexedAt" bson:"indexed_at"`
}

// EJCameraImage is one ATM camera capture referenced in the EJ block.
type EJCameraImage struct {
	Camera   int    `json:"camera" bson:"camera"`
	Filename string `json:"filename" bson:"filename"`
}

// EJTransactionSearchRequest is the Reports EJ lookup filter.
type EJTransactionSearchRequest struct {
	DateFrom        string   `json:"dateFrom,omitempty"`
	DateTo          string   `json:"dateTo,omitempty"`
	CardFirst4      string   `json:"cardFirst4,omitempty"`
	CardLast4       string   `json:"cardLast4,omitempty"`
	Terminal        string   `json:"terminal,omitempty"`
	AuthNum         string   `json:"authNum,omitempty"`
	Status          string   `json:"status,omitempty"`          // SUCCESS | FAILED
	Amount          *float64 `json:"amount,omitempty"`          // exact match when set
	CustomerAccount string   `json:"customerAccount,omitempty"` // CRM customer info
}

// EJTransactionSearchResult is a single paged search response.
type EJTransactionSearchResult struct {
	Page     int             `json:"page"`
	PageSize int             `json:"pageSize"`
	HasMore  bool            `json:"hasMore"`
	Items    []EJTransaction `json:"items"`
}

// EJJournalView is the journal block used by "Open journal" in EJ Finder.
type EJJournalView struct {
	ID         string `json:"id"`
	TerminalID string `json:"terminalId"`
	Filename   string `json:"filename"`
	Path       string `json:"path,omitempty"`
	EJDate     string `json:"ejDate,omitempty"`
	LineStart  int    `json:"lineStart,omitempty"`
	LineEnd    int    `json:"lineEnd,omitempty"`
	FileOffset int64  `json:"fileOffset,omitempty"`
	RawText    string `json:"rawText"`
	Source     string `json:"source"` // indexed | file
}

// EJJournalFileView is the full journal file for "View whole file".
type EJJournalFileView struct {
	ID            string `json:"id"`
	TerminalID    string `json:"terminalId"`
	Filename      string `json:"filename"`
	Path          string `json:"path,omitempty"`
	EJDate        string `json:"ejDate,omitempty"`
	SizeBytes     int64  `json:"sizeBytes"`
	Content       string `json:"content"`
	Truncated        bool `json:"truncated"`
	HighlightLine    int  `json:"highlightLine,omitempty"`
	HighlightLineEnd int  `json:"highlightLineEnd,omitempty"`
}

// EJCoverageRequest is the date window for EJ sync coverage.
type EJCoverageRequest struct {
	DateFrom string `json:"dateFrom"`
	DateTo   string `json:"dateTo"`
}

// EJCoverageDaySummary is synced vs missing counts for one calendar day.
type EJCoverageDaySummary struct {
	Date        string `json:"date"`
	Synced      int    `json:"synced"`
	Missing     int    `json:"missing"`
	TotalActive int    `json:"totalActive"`
}

// EJCoverageWeekSummary rolls up the 7 days ending at the selected dateTo.
type EJCoverageWeekSummary struct {
	DateFrom            string  `json:"dateFrom"`
	DateTo              string  `json:"dateTo"`
	AvgSynced           float64 `json:"avgSynced"`
	SyncedTerminalDays  int     `json:"syncedTerminalDays"`
	MissingTerminalDays int     `json:"missingTerminalDays"`
	TotalActive         int     `json:"totalActive"`
	DayCount            int     `json:"dayCount"`
}

// EJCoverageDayCell is one terminal's sync state for one day.
type EJCoverageDayCell struct {
	Synced    bool       `json:"synced"`
	TxnCount  int        `json:"txnCount,omitempty"`
	IndexedAt *time.Time `json:"indexedAt,omitempty"`
}

// EJCoverageTerminal is one active ATM with per-day sync cells.
type EJCoverageTerminal struct {
	TerminalID   string                      `json:"terminalId"`
	TerminalName string                      `json:"terminalName"`
	Status       string                      `json:"status"`
	Days         map[string]EJCoverageDayCell `json:"days"`
}

// EJCoverageResult is the EJ coverage API payload.
type EJCoverageResult struct {
	DateFrom    string                 `json:"dateFrom"`
	DateTo      string                 `json:"dateTo"`
	TotalActive int                    `json:"totalActive"`
	Focus       EJCoverageDaySummary   `json:"focus"`
	Week        EJCoverageWeekSummary  `json:"week"`
	Days        []EJCoverageDaySummary `json:"days"`
	Terminals   []EJCoverageTerminal   `json:"terminals"`
}

// EJBrowseTerminal is one terminal with indexed EJ files in a date window.
type EJBrowseTerminal struct {
	TerminalID string `json:"terminalId"`
	FileCount  int    `json:"fileCount"`
	TxnCount   int    `json:"txnCount"`
}

// EJBrowseFile is one indexed journal file for browse-by-terminal.
type EJBrowseFile struct {
	TerminalID string `json:"terminalId"`
	Filename   string `json:"filename"`
	EJDate     string `json:"ejDate"`
	Path       string `json:"path,omitempty"`
	Size       int64  `json:"size"`
	TxnCount   int    `json:"txnCount"`
	AtmType    string `json:"atmType,omitempty"`
}
