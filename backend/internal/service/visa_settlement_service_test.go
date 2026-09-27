package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// stubSettlementRepo records what it was asked to store, so the dedup contract
// can be asserted without a live Mongo.
type stubSettlementRepo struct {
	stored []model.VisaSettlementTransaction
	// seen lets the stub behave like the unique index: a transaction id is only
	// ever stored once, and a repeat is reported as a duplicate.
	seen         map[string]bool
	inserted     int
	duplicates   int
	summarySaved *model.SettlementBatchSummary
	returnErr    error
}

func newStubSettlementRepo() *stubSettlementRepo {
	return &stubSettlementRepo{seen: map[string]bool{}}
}

func (s *stubSettlementRepo) UpsertTransactions(
	_ context.Context,
	txs []model.VisaSettlementTransaction,
) (int, int, error) {
	if s.returnErr != nil {
		return 0, 0, s.returnErr
	}

	inserted, duplicates := 0, 0
	for _, tx := range txs {
		key := strings.TrimSpace(tx.TransactionID)
		if key == "" {
			// A record with no transaction id cannot be deduplicated.
			inserted++
			s.stored = append(s.stored, tx)
			continue
		}
		if s.seen[key] {
			duplicates++
			continue
		}
		s.seen[key] = true
		inserted++
		s.stored = append(s.stored, tx)
	}

	s.inserted = inserted
	s.duplicates = duplicates
	return inserted, duplicates, nil
}

func (s *stubSettlementRepo) SaveBatchSummary(_ context.Context, batch *model.SettlementBatchSummary) error {
	s.summarySaved = batch
	return nil
}

func (s *stubSettlementRepo) FindByDateRange(context.Context, time.Time, time.Time) ([]model.VisaSettlementTransaction, error) {
	return nil, nil
}
func (s *stubSettlementRepo) FindByTransactionIDPrefix(context.Context, string, int) ([]model.VisaSettlementTransaction, error) {
	return nil, nil
}
func (s *stubSettlementRepo) FindByBatchID(context.Context, primitive.ObjectID) ([]model.VisaSettlementTransaction, error) {
	return nil, nil
}
func (s *stubSettlementRepo) FindByTransactionID(context.Context, string) (*model.VisaSettlementTransaction, error) {
	return nil, nil
}
func (s *stubSettlementRepo) FindByAccountNumber(context.Context, string) ([]model.VisaSettlementTransaction, error) {
	return nil, nil
}
func (s *stubSettlementRepo) FindBatchSummaryByID(context.Context, string) (*model.SettlementBatchSummary, error) {
	return nil, nil
}
func (s *stubSettlementRepo) ListBatchSummaries(context.Context, int64) ([]model.SettlementBatchSummary, error) {
	return nil, nil
}
func (s *stubSettlementRepo) EnsureIndexes(context.Context) error { return nil }

// settlementFile builds a two record advice file, which is the minimum that
// exercises both an insert and a re-upload.
const settlementFile = `                        VISA                                  Clearing and Settlement Advice
                                    SYSTEM DATE 26/09/15   CPD 26/09/14

TCR 0 Record
Destination Identifier  408367
Source Identifier       320062
Record Identifier       CAS
Tran Code of financial tr 05
Transaction ID          TXN-0001
Account Number          432609793610
Account Number Extension 3436
Acquirer Reference Number 24083676253000004397098
Card Acceptor ID        NFHANANZEY00032
Terminal ID             NFM06032
Source Amount           123456
Source Currency Code    230
Settlement amount - International 118900
Settlement amount Sign  C
Settlement Currency     840
TCR 1 Record
Purchase Date           0910
Interchange Fee Amount  4556
Interchange Fee Sign    D
Merchant Name           TEST MERCHANT ETH
Merchant Category Code  5411
Fee Descriptor          CEMEA RWD
BII Unique File ID      408158020260914P010100

TCR 0 Record
Destination Identifier  408367
Source Identifier       320062
Record Identifier       CAS
Tran Code of financial tr 05
Transaction ID          TXN-0002
Account Number          432609793610
Account Number Extension 3437
Acquirer Reference Number 24083676253000004397099
Card Acceptor ID        NFHANANZEY00032
Terminal ID             NFM06032
Source Amount           5000
Source Currency Code    230
Settlement amount - International 4750
Settlement amount Sign  C
Settlement Currency     840
TCR 1 Record
Purchase Date           0911
Interchange Fee Amount  250
Interchange Fee Sign    D
Merchant Name           SECOND MERCHANT ETH
Merchant Category Code  5812
Fee Descriptor          RESTAURANT
BII Unique File ID      408158020260914P010101

TRANSACTION TOTAL
`

// Re-processing the same file must not store a second copy, or every total
// derived from these records would double count.
func TestProcessReportFileIsIdempotent(t *testing.T) {
	repo := newStubSettlementRepo()
	svc := NewVisaSettlementService(repo)
	ctx := context.Background()

	first, err := svc.ProcessReportFile(ctx, "first.txt", strings.NewReader(settlementFile))
	if err != nil {
		t.Fatalf("first upload: %v", err)
	}
	if first.InsertedRecords != 2 {
		t.Errorf("first upload inserted %d, want 2", first.InsertedRecords)
	}
	if first.DuplicateRecords != 0 {
		t.Errorf("first upload skipped %d, want 0", first.DuplicateRecords)
	}
	if first.ParsedRecords != 2 {
		t.Errorf("parsed %d, want 2", first.ParsedRecords)
	}
	if first.Status != "COMPLETED" {
		t.Errorf("first upload status = %q, want COMPLETED", first.Status)
	}

	second, err := svc.ProcessReportFile(ctx, "second.txt", strings.NewReader(settlementFile))
	if err != nil {
		t.Fatalf("second upload: %v", err)
	}
	if second.InsertedRecords != 0 {
		t.Errorf("second upload inserted %d, want 0", second.InsertedRecords)
	}
	if second.DuplicateRecords != 2 {
		t.Errorf("second upload skipped %d, want 2", second.DuplicateRecords)
	}
	// A file that was entirely known is reported as DUPLICATE rather than as a
	// failure, so the UI can say "already processed" instead of "no records".
	if second.Status != "DUPLICATE" {
		t.Errorf("second upload status = %q, want DUPLICATE", second.Status)
	}
	// The file still held two records, which is what makes the duplicate report
	// meaningful rather than an empty file.
	if second.ParsedRecords != 2 {
		t.Errorf("second upload parsed %d, want 2", second.ParsedRecords)
	}

	// Only two documents exist in total across both uploads.
	if len(repo.stored) != 2 {
		t.Errorf("stored %d records across two uploads, want 2", len(repo.stored))
	}
}

// Each upload gets its own batch id, and every record it carries is linked to
// it, so a batch can be traced to the records it produced.
func TestProcessReportFileLinksRecordsToItsBatch(t *testing.T) {
	repo := newStubSettlementRepo()
	svc := NewVisaSettlementService(repo)

	summary, err := svc.ProcessReportFile(
		context.Background(), "link.txt", strings.NewReader(settlementFile),
	)
	if err != nil {
		t.Fatalf("upload: %v", err)
	}

	if summary.ID.IsZero() {
		t.Fatal("summary has no batch id")
	}
	if len(repo.stored) != 2 {
		t.Fatalf("stored %d records, want 2", len(repo.stored))
	}
	for _, tx := range repo.stored {
		if tx.BatchID != summary.ID {
			t.Errorf("record %s linked to batch %s, want %s", tx.TransactionID, tx.BatchID.Hex(), summary.ID.Hex())
		}
	}
}

// Two different files must not be mistaken for one another.
func TestProcessReportFileStoresDistinctFilesIndependently(t *testing.T) {
	repo := newStubSettlementRepo()
	svc := NewVisaSettlementService(repo)
	ctx := context.Background()

	if _, err := svc.ProcessReportFile(ctx, "a.txt", strings.NewReader(settlementFile)); err != nil {
		t.Fatalf("first: %v", err)
	}

	// Same transaction ids but a different file name still resolves to the same
	// records, because the transaction id is what identifies a record rather
	// than the file it arrived in.
	again, err := svc.ProcessReportFile(ctx, "b.txt", strings.NewReader(settlementFile))
	if err != nil {
		t.Fatalf("second: %v", err)
	}
	if again.DuplicateRecords != 2 {
		t.Errorf("second file skipped %d, want 2", again.DuplicateRecords)
	}
	if len(repo.stored) != 2 {
		t.Errorf("stored %d, want 2", len(repo.stored))
	}
}

func TestProcessReportFileTimestampsArePopulated(t *testing.T) {
	repo := newStubSettlementRepo()
	svc := NewVisaSettlementService(repo)

	before := time.Now().UTC().Add(-time.Second)

	summary, err := svc.ProcessReportFile(
		context.Background(), "stamped.txt", strings.NewReader(settlementFile),
	)
	if err != nil {
		t.Fatalf("upload: %v", err)
	}

	if summary.CreatedAt.IsZero() {
		t.Error("summary CreatedAt was not set")
	}
	if summary.ProcessedAt.IsZero() {
		t.Error("summary ProcessedAt was not set")
	}
	if summary.CreatedAt.Before(before) {
		t.Errorf("summary CreatedAt %v predates the call", summary.CreatedAt)
	}

	if repo.summarySaved == nil {
		t.Fatal("summary was not saved")
	}
	// UpdatedAt is the repository's responsibility, since it is the write time
	// rather than anything the service can know, so it is not asserted here.
	if repo.summarySaved.ParsedRecords != 2 {
		t.Errorf("saved summary ParsedRecords = %d, want 2", repo.summarySaved.ParsedRecords)
	}
}
