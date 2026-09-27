package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// VisaSettlementTransaction represents a complete merged TCR 0 + TCR 1 transaction entry.
type VisaSettlementTransaction struct {
	ID primitive.ObjectID `bson:"_id,omitempty" json:"id"`

	// BatchID is the settlement upload this record was captured from.
	//
	// Without it there is no way to ask what a given upload produced, because the
	// parsed transaction date is derived from the file's own header and can land
	// outside any range a user would guess. It is a plain ObjectID to match the
	// batch summary, so a record can be traced to the file that produced it.
	BatchID primitive.ObjectID `bson:"batch_id,omitempty" json:"batch_id"`

	// Report Metadata
	ReportID   string `bson:"report_id" json:"report_id"`     // e.g., "VX-733F"
	PageNumber int    `bson:"page_number" json:"page_number"` // e.g., 1
	SystemDate string `bson:"system_date" json:"system_date"` // e.g., "26/09/15"
	CPD        string `bson:"cpd" json:"cpd"`                 // Central Processing Date (e.g., "26/09/14")

	// Ingest timestamps, all UTC, recording when this app saw the record
	// rather than when the transaction happened. Kept separate from
	// TransactionDate, which is derived from the file's own header.
	//
	// CreatedAt is when the record was first stored. UpdatedAt moves whenever a
	// later upload of the same transaction changes it. FirstSeenBatchID and
	// LastSeenBatchID are the uploads that first stored and last touched it, so
	// a re-processed transaction stays traceable to every file that carried it.
	CreatedAt        time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt        time.Time          `bson:"updated_at" json:"updated_at"`
	FirstSeenBatchID primitive.ObjectID `bson:"first_seen_batch_id,omitempty" json:"first_seen_batch_id,omitempty"`
	LastSeenBatchID  primitive.ObjectID `bson:"last_seen_batch_id,omitempty" json:"last_seen_batch_id,omitempty"`
	// SeenCount is how many uploads have carried this transaction. A value
	// above 1 means the same record appeared in more than one file.
	SeenCount int `bson:"seen_count" json:"seen_count"`

	// TCR 0 Data Points
	DestinationIdentifier string `bson:"destination_identifier" json:"destination_identifier"` // e.g., "408367"
	SourceIdentifier      string `bson:"source_identifier" json:"source_identifier"`           // e.g., "320062"
	RecordIdentifier      string `bson:"record_identifier" json:"record_identifier"`           // e.g., "CAS"
	TranCode              string `bson:"tran_code" json:"tran_code"`                           // e.g., "05"
	// TransactionID is the dedup key and is the only field with a unique index.
	// It is omitted from the stored document when blank, because two records
	// both holding an empty string would collide on that index, and records with
	// no transaction id cannot be told apart anyway. Omitting the field also
	// keeps such records outside the index's partial filter, which only covers
	// documents where the field is a string.
	TransactionID        string  `bson:"transaction_id,omitempty" json:"transaction_id"`   // e.g., "386253529181829"
	AccountNumber        string  `bson:"account_number" json:"account_number"`             // e.g., "4326097936103436"
	AcquirerRefNumber    string  `bson:"acquirer_ref_number" json:"acquirer_ref_number"`   // e.g., "24083676253000004397098"
	CardAcceptorID       string  `bson:"card_acceptor_id" json:"card_acceptor_id"`         // e.g., "NFHANANZEY00032"
	TerminalID           string  `bson:"terminal_id" json:"terminal_id"`                   // e.g., "NFM06032"
	SourceAmount         float64 `bson:"source_amount" json:"source_amount"`               // Raw integer parsed to currency units
	SourceCurrencyCode   string  `bson:"source_currency_code" json:"source_currency_code"` // e.g., "230"
	SettlementAmount     float64 `bson:"settlement_amount" json:"settlement_amount"`
	SettlementAmountSign string  `bson:"settlement_amount_sign" json:"settlement_amount_sign"` // e.g., "C"
	SettlementCurrency   string  `bson:"settlement_currency" json:"settlement_currency"`       // e.g., "840"

	TransactionDate time.Time `bson:"transaction_date" json:"transaction_date"`

	// TCR 1 Data Points
	InterchangeFeeAmount float64 `bson:"interchange_fee_amount" json:"interchange_fee_amount"`
	InterchangeFeeSign   string  `bson:"interchange_fee_sign" json:"interchange_fee_sign"`     // e.g., "D"
	MerchantName         string  `bson:"merchant_name" json:"merchant_name"`                   // e.g., "HANAN ZEYINU HABIB ETH"
	MerchantCategoryCode string  `bson:"merchant_category_code" json:"merchant_category_code"` // e.g., "5411"
	FeeDescriptor        string  `bson:"fee_descriptor" json:"fee_descriptor"`                 // e.g., "CEMEA RWD"
	BIIUniqueFileID      string  `bson:"bii_unique_file_id" json:"bii_unique_file_id"`         // e.g., "408158020260914P010100"
	PurchaseDate         string  `bson:"purchase_date" json:"purchase_date"`                   // e.g., "0910"
}

// SettlementBatchSummary tracks uploaded file metadata and processing stats.
//
// ID is a plain ObjectID, which is the only _id shape this collection stores.
// A 16-byte binary UUID was written by an earlier build and decoding it into
// an ObjectID aborted the whole listing cursor, so a single unreadable row took
// every healthy upload down with it. That data has been cleared, and nothing
// writes a non-ObjectID here any more.
type SettlementBatchSummary struct {
	ID           primitive.ObjectID `bson:"_id" json:"id"`
	FileName     string             `bson:"file_name" json:"file_name"`
	TotalRecords int                `bson:"total_records" json:"total_records"`
	ProcessedAt  time.Time          `bson:"processed_at" json:"processed_at"`
	Status       string             `bson:"status" json:"status"` // e.g., "COMPLETED", "FAILED"
	ErrorMessage string             `bson:"error_message,omitempty" json:"error_message,omitempty"`

	// ParsedRecords is how many records the file contained, and InsertedRecords
	// how many were actually new. They differ when the file was already
	// processed, which is why a re-upload is not reported as zero work.
	ParsedRecords   int `bson:"parsed_records" json:"parsed_records"`
	InsertedRecords int `bson:"inserted_records" json:"inserted_records"`
	// DuplicateRecords is how many were skipped because that transaction id had
	// already been stored by an earlier upload.
	DuplicateRecords int `bson:"duplicate_records" json:"duplicate_records"`
	// CreatedAt is when the upload was received, kept alongside ProcessedAt so
	// the two can be compared on a slow ingest.
	CreatedAt time.Time `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time `bson:"updated_at" json:"updated_at"`
}
