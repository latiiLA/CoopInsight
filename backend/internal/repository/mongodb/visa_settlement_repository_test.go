package mongodb

import (
	"testing"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// The upsert used to name only the metadata fields, so every record it created
// held a transaction id and timestamps and none of the parsed data. These tests
// build the same update document the repository builds and assert the parsed
// fields are actually in it, so that cannot regress unnoticed.
func upsertFields(t *testing.T, tx model.VisaSettlementTransaction) bson.M {
	t.Helper()

	raw, err := bson.Marshal(tx)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var set bson.M
	if err := bson.Unmarshal(raw, &set); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	// Mirrors the deletions the repository performs before using this as $set.
	delete(set, "_id")
	delete(set, "created_at")
	delete(set, "updated_at")
	delete(set, "first_seen_batch_id")
	delete(set, "last_seen_batch_id")
	delete(set, "seen_count")

	return set
}

func sampleTransaction() model.VisaSettlementTransaction {
	return model.VisaSettlementTransaction{
		ID:                    primitive.NewObjectID(),
		BatchID:               primitive.NewObjectID(),
		TransactionID:         "386253529181829",
		AccountNumber:         "4326097936103436000",
		AcquirerRefNumber:     "24083676253000004397098",
		CardAcceptorID:        "NFHANANZEY00032",
		TerminalID:            "NFM06032",
		SourceAmount:          2535,
		SourceCurrencyCode:    "230",
		SettlementAmount:      15.77,
		SettlementAmountSign:  "C",
		SettlementCurrency:    "840",
		InterchangeFeeAmount:  3075.15,
		InterchangeFeeSign:    "D",
		MerchantName:          "HANAN ZEYINU HABIB ETH",
		MerchantCategoryCode:  "5411",
		FeeDescriptor:         "CEMEA RWD",
		BIIUniqueFileID:       "408158020260914P010100",
		PurchaseDate:          "0910",
		TransactionDate:       time.Date(2014, 9, 10, 0, 0, 0, 0, time.UTC),
		CPD:                   "26/09/14",
		SystemDate:            "26/09/15",
		ReportID:              "CPD",
		PageNumber:            1,
		RecordIdentifier:      "CAS",
		SourceIdentifier:      "320062",
		DestinationIdentifier: "408367",
		TranCode:              "05",
	}
}

func TestUpsertSetCarriesEveryParsedField(t *testing.T) {
	set := upsertFields(t, sampleTransaction())

	// The exact fields that were silently lost.
	required := []string{
		"transaction_id", "account_number", "acquirer_ref_number", "card_acceptor_id",
		"terminal_id", "source_amount", "source_currency_code", "settlement_amount",
		"settlement_amount_sign", "settlement_currency", "interchange_fee_amount",
		"interchange_fee_sign", "merchant_name", "merchant_category_code",
		"fee_descriptor", "bii_unique_file_id", "purchase_date", "transaction_date",
		"cpd", "system_date", "report_id", "page_number", "record_identifier",
		"source_identifier", "destination_identifier", "tran_code", "batch_id",
	}

	for _, field := range required {
		if _, ok := set[field]; !ok {
			t.Errorf("$set is missing %q; an upsert only writes named fields, so this would be dropped", field)
		}
	}
}

func TestUpsertSetOmitsFieldsMongoRejects(t *testing.T) {
	set := upsertFields(t, sampleTransaction())

	// _id is rejected in an update document.
	if _, ok := set["_id"]; ok {
		t.Error("$set contains _id, which MongoDB rejects in an update document")
	}

	// The repository owns these, so they must not be taken from the struct and
	// then also written by $setOnInsert or the increment.
	for _, field := range []string{
		"created_at", "updated_at", "first_seen_batch_id", "last_seen_batch_id", "seen_count",
	} {
		if _, ok := set[field]; ok {
			t.Errorf("$set contains %q, which is owned by the repository", field)
		}
	}
}

// The unique index must not cover records with no transaction id, because two
// such records cannot be told apart and would collide.
func TestBlankTransactionIDIsOmittedFromTheStoredDocument(t *testing.T) {
	tx := sampleTransaction()
	tx.TransactionID = ""

	raw, err := bson.Marshal(tx)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var stored bson.M
	if err := bson.Unmarshal(raw, &stored); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if _, ok := stored["transaction_id"]; ok {
		t.Error("a blank transaction id is stored as a string, which the unique index would reject on the second record")
	}
}

func TestPopulatedTransactionIDIsStored(t *testing.T) {
	raw, err := bson.Marshal(sampleTransaction())
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var stored bson.M
	if err := bson.Unmarshal(raw, &stored); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	got, ok := stored["transaction_id"].(string)
	if !ok {
		t.Fatalf("transaction_id missing or wrong type: %v", stored["transaction_id"])
	}
	if got != "386253529181829" {
		t.Errorf("transaction_id = %q, want 386253529181829", got)
	}
}
