package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Mastercard IPM message classifications.
const (
	IPMMessageHeader            = "HEADER"
	IPMMessageTrailer           = "TRAILER"
	IPMMessageSettlementSummary = "SETTLEMENT_SUMMARY"
	IPMMessageFinancial         = "FINANCIAL"
	IPMMessageOther             = "OTHER"
)

// MastercardIPMTransaction represents a parsed Mastercard IPM clearing /
// settlement message (administrative summary or financial presentment).
type MastercardIPMTransaction struct {
	ID primitive.ObjectID `bson:"_id,omitempty" json:"id"`

	// BatchID is the upload this record was captured from.
	BatchID primitive.ObjectID `bson:"batch_id,omitempty" json:"batch_id"`

	// BusinessKey uniquely identifies a message within a Mastercard file:
	// file_id (PDS 0105) + message_number (DE71) + function_code (DE24).
	// It is omitted when blank so partial documents stay outside the unique index.
	BusinessKey string `bson:"business_key,omitempty" json:"business_key,omitempty"`

	// Message metadata
	MTI           string `bson:"mti" json:"mti"`                       // Message Type Indicator (e.g. "1644", "1240")
	FunctionCode  string `bson:"function_code" json:"function_code"`   // DE24
	MessageNumber string `bson:"message_number" json:"message_number"` // DE71
	MessageType   string `bson:"message_type" json:"message_type"`     // HEADER / TRAILER / SETTLEMENT_SUMMARY / FINANCIAL / OTHER
	FileID        string `bson:"file_id" json:"file_id"`               // PDS 0105 when present (propagated from header)
	FileName      string `bson:"file_name" json:"file_name"`           // Uploaded file name

	// Ingest timestamps
	CreatedAt        time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt        time.Time          `bson:"updated_at" json:"updated_at"`
	FirstSeenBatchID primitive.ObjectID `bson:"first_seen_batch_id,omitempty" json:"first_seen_batch_id,omitempty"`
	LastSeenBatchID  primitive.ObjectID `bson:"last_seen_batch_id,omitempty" json:"last_seen_batch_id,omitempty"`
	SeenCount        int                `bson:"seen_count" json:"seen_count"`

	// DE25 - Message Reason Code (n-4 in IPM clearing)
	MessageReasonCode string `bson:"message_reason_code,omitempty" json:"message_reason_code,omitempty"`

	// Institution IDs (LLVAR in IPM)
	DestinationInstitutionID string `bson:"destination_institution_id,omitempty" json:"destination_institution_id,omitempty"` // DE93
	OriginatorInstitutionID  string `bson:"originator_institution_id,omitempty" json:"originator_institution_id,omitempty"`   // DE100
	AcquirerID               string `bson:"acquirer_id,omitempty" json:"acquirer_id,omitempty"`                               // DE32 when present

	// Currency
	CurrencyCode       string `bson:"currency_code,omitempty" json:"currency_code,omitempty"`             // DE49
	SettlementCurrency string `bson:"settlement_currency,omitempty" json:"settlement_currency,omitempty"` // DE50

	// PDS (DE48) tag -> value map for settlement amounts / file ids / counts
	PDS map[string]string `bson:"pds,omitempty" json:"pds,omitempty"`

	// Presentment-oriented fields (MTI 1240 / similar T112 files)
	PAN                  string `bson:"pan,omitempty" json:"pan,omitempty"` // DE2
	ProcessingCode       string `bson:"processing_code,omitempty" json:"processing_code,omitempty"`
	Amount               int64  `bson:"amount,omitempty" json:"amount,omitempty"` // DE4 minor units
	TransmissionDateTime string `bson:"transmission_date_time,omitempty" json:"transmission_date_time,omitempty"`
	STAN                 string `bson:"stan,omitempty" json:"stan,omitempty"`
	LocalTime            string `bson:"local_time,omitempty" json:"local_time,omitempty"` // DE12
	LocalDate            string `bson:"local_date,omitempty" json:"local_date,omitempty"` // DE13
	MerchantType         string `bson:"merchant_type,omitempty" json:"merchant_type,omitempty"`
	POSEntryMode         string `bson:"pos_entry_mode,omitempty" json:"pos_entry_mode,omitempty"`
	TerminalID           string `bson:"terminal_id,omitempty" json:"terminal_id,omitempty"`
	CardAcceptorID       string `bson:"card_acceptor_id,omitempty" json:"card_acceptor_id,omitempty"`
	CardAcceptorName     string `bson:"card_acceptor_name,omitempty" json:"card_acceptor_name,omitempty"`

	// Derived transaction date (presentments)
	TransactionDate time.Time `bson:"transaction_date,omitempty" json:"transaction_date,omitempty"`
}

// MastercardIPMBatchSummary tracks uploaded file metadata and processing stats.
type MastercardIPMBatchSummary struct {
	ID       primitive.ObjectID `bson:"_id" json:"id"`
	FileName string             `bson:"file_name" json:"file_name"`
	// FileID is PDS 0105 from the IPM file header when present.
	FileID           string    `bson:"file_id,omitempty" json:"file_id,omitempty"`
	TotalRecords     int       `bson:"total_records" json:"total_records"`
	ProcessedAt      time.Time `bson:"processed_at" json:"processed_at"`
	Status           string    `bson:"status" json:"status"` // "COMPLETED", "FAILED", "DUPLICATE"
	ErrorMessage     string    `bson:"error_message,omitempty" json:"error_message,omitempty"`
	ParsedRecords    int       `bson:"parsed_records" json:"parsed_records"`
	InsertedRecords  int       `bson:"inserted_records" json:"inserted_records"`
	DuplicateRecords int       `bson:"duplicate_records" json:"duplicate_records"`
	// ParsedMessages is the total ISO messages found in the file (incl. header/trailer).
	ParsedMessages int       `bson:"parsed_messages,omitempty" json:"parsed_messages,omitempty"`
	CreatedAt      time.Time `bson:"created_at" json:"created_at"`
	UpdatedAt      time.Time `bson:"updated_at" json:"updated_at"`
}
