package service

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type stubIPMRepo struct {
	stored       []model.MastercardIPMTransaction
	seen         map[string]bool
	inserted     int
	duplicates   int
	summarySaved *model.MastercardIPMBatchSummary
	returnErr    error
}

func newStubIPMRepo() *stubIPMRepo {
	return &stubIPMRepo{seen: map[string]bool{}}
}

func (s *stubIPMRepo) UpsertTransactions(_ context.Context, txs []model.MastercardIPMTransaction) (int, int, error) {
	if s.returnErr != nil {
		return 0, 0, s.returnErr
	}
	inserted, duplicates := 0, 0
	for _, tx := range txs {
		key := strings.TrimSpace(tx.BusinessKey)
		if key == "" {
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

func (s *stubIPMRepo) SaveBatchSummary(_ context.Context, batch *model.MastercardIPMBatchSummary) error {
	s.summarySaved = batch
	return nil
}

func (s *stubIPMRepo) FindByDateRange(context.Context, time.Time, time.Time) ([]model.MastercardIPMTransaction, error) {
	return nil, nil
}
func (s *stubIPMRepo) FindSettlementSummariesByDateRange(context.Context, time.Time, time.Time) ([]model.MastercardIPMTransaction, error) {
	return nil, nil
}
func (s *stubIPMRepo) FindBySTANPrefix(context.Context, string, int) ([]model.MastercardIPMTransaction, error) {
	return nil, nil
}
func (s *stubIPMRepo) FindByBatchID(context.Context, primitive.ObjectID) ([]model.MastercardIPMTransaction, error) {
	return nil, nil
}
func (s *stubIPMRepo) FindBySTAN(context.Context, string) (*model.MastercardIPMTransaction, error) {
	return nil, nil
}
func (s *stubIPMRepo) FindByPAN(context.Context, string) ([]model.MastercardIPMTransaction, error) {
	return nil, nil
}
func (s *stubIPMRepo) FindBatchSummaryByID(context.Context, string) (*model.MastercardIPMBatchSummary, error) {
	return nil, nil
}
func (s *stubIPMRepo) ListBatchSummaries(context.Context, int64) ([]model.MastercardIPMBatchSummary, error) {
	return nil, nil
}
func (s *stubIPMRepo) EnsureIndexes(context.Context) error { return nil }

func loadSampleIPM(t *testing.T) []byte {
	t.Helper()
	path := filepath.Join("testdata", "TT113T0.2026-09-29-02-20-05.001")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read sample IPM: %v", err)
	}
	return data
}

func TestParseIPMFile_SampleTT113(t *testing.T) {
	data := loadSampleIPM(t)
	msgs := parseIPMFile(data, "TT113T0.2026-09-29-02-20-05.001")

	if len(msgs) != 4 {
		t.Fatalf("expected 4 messages, got %d", len(msgs))
	}

	want := []struct {
		functionCode  string
		messageType   string
		messageNumber string
		currency      string
		settlementCur string
		institution   string
		hasFileID     bool
	}{
		{"697", model.IPMMessageHeader, "00000001", "", "", "", true},
		{"680", model.IPMMessageSettlementSummary, "00000002", "230", "", "034457", false},
		{"685", model.IPMMessageSettlementSummary, "00000003", "230", "840", "034457", false},
		{"695", model.IPMMessageTrailer, "00000004", "", "", "", true},
	}

	for i, w := range want {
		got := msgs[i]
		if got.MTI != "1644" {
			t.Errorf("msg %d MTI=%s want 1644", i+1, got.MTI)
		}
		if got.FunctionCode != w.functionCode {
			t.Errorf("msg %d function=%s want %s", i+1, got.FunctionCode, w.functionCode)
		}
		if got.MessageType != w.messageType {
			t.Errorf("msg %d type=%s want %s", i+1, got.MessageType, w.messageType)
		}
		if got.MessageNumber != w.messageNumber {
			t.Errorf("msg %d number=%s want %s", i+1, got.MessageNumber, w.messageNumber)
		}
		if got.CurrencyCode != w.currency {
			t.Errorf("msg %d currency=%s want %s", i+1, got.CurrencyCode, w.currency)
		}
		if got.SettlementCurrency != w.settlementCur {
			t.Errorf("msg %d settlement currency=%s want %s", i+1, got.SettlementCurrency, w.settlementCur)
		}
		if w.institution != "" {
			if got.DestinationInstitutionID != w.institution {
				t.Errorf("msg %d DE93=%s want %s", i+1, got.DestinationInstitutionID, w.institution)
			}
			if got.OriginatorInstitutionID != w.institution {
				t.Errorf("msg %d DE100=%s want %s", i+1, got.OriginatorInstitutionID, w.institution)
			}
		}
		if w.hasFileID {
			if got.FileID == "" || got.PDS == nil || got.PDS["0105"] == "" {
				t.Errorf("msg %d missing PDS 0105 file id", i+1)
			}
		}
	}

	// Trailer PDS 0306 message count
	if msgs[3].PDS["0306"] != "00000004" {
		t.Errorf("trailer PDS 0306=%q want 00000004", msgs[3].PDS["0306"])
	}

	// Padding after last message must not invent extra records.
	if len(msgs) != 4 {
		t.Errorf("padding produced extra messages: %d", len(msgs))
	}
}

func TestParsePDS_CommonTags(t *testing.T) {
	pds := parsePDS("010502500326092900000034457022010122001P")
	if pds["0105"] != "0032609290000003445702201" {
		t.Fatalf("0105=%q", pds["0105"])
	}
	if pds["0122"] != "P" {
		t.Fatalf("0122=%q", pds["0122"])
	}
}

func TestProcessReportFile_SampleRegistersSummaries(t *testing.T) {
	data := loadSampleIPM(t)
	repo := newStubIPMRepo()
	svc := NewMastercardIPMService(repo)

	summary, err := svc.ProcessReportFile(context.Background(), "TT113T0.2026-09-29-02-20-05.001", bytes.NewReader(data))
	if err != nil {
		t.Fatalf("ProcessReportFile: %v", err)
	}
	if summary.Status != "COMPLETED" {
		t.Fatalf("status=%s err=%s", summary.Status, summary.ErrorMessage)
	}
	if summary.ParsedMessages != 4 {
		t.Errorf("ParsedMessages=%d want 4", summary.ParsedMessages)
	}
	if summary.ParsedRecords != 2 {
		t.Errorf("ParsedRecords=%d want 2", summary.ParsedRecords)
	}
	if summary.InsertedRecords != 2 {
		t.Errorf("InsertedRecords=%d want 2", summary.InsertedRecords)
	}
	if summary.FileID == "" {
		t.Error("batch FileID empty; expected PDS 0105 from header")
	}
	if len(repo.stored) != 2 {
		t.Fatalf("stored %d want 2", len(repo.stored))
	}

	byFunc := map[string]model.MastercardIPMTransaction{}
	for _, tx := range repo.stored {
		byFunc[tx.FunctionCode] = tx
	}
	for _, code := range []string{"680", "685"} {
		tx, ok := byFunc[code]
		if !ok {
			t.Fatalf("missing registered function %s", code)
			continue
		}
		if tx.MessageType != model.IPMMessageSettlementSummary {
			t.Errorf("%s type=%s", code, tx.MessageType)
		}
		if tx.CurrencyCode != "230" {
			t.Errorf("%s currency=%s", code, tx.CurrencyCode)
		}
		if tx.OriginatorInstitutionID != "034457" {
			t.Errorf("%s institution=%s", code, tx.OriginatorInstitutionID)
		}
		if tx.FileID != summary.FileID {
			t.Errorf("%s file_id=%s want %s", code, tx.FileID, summary.FileID)
		}
		if !strings.Contains(tx.BusinessKey, code) {
			t.Errorf("%s business_key=%s", code, tx.BusinessKey)
		}
	}
	if byFunc["680"].MessageNumber != "00000002" {
		t.Errorf("680 message number=%s", byFunc["680"].MessageNumber)
	}
	if byFunc["685"].MessageNumber != "00000003" {
		t.Errorf("685 message number=%s", byFunc["685"].MessageNumber)
	}
	if byFunc["685"].SettlementCurrency != "840" {
		t.Errorf("685 settlement currency=%s", byFunc["685"].SettlementCurrency)
	}
	fileDate := time.Date(2026, time.September, 29, 0, 0, 0, 0, time.UTC)
	for _, code := range []string{"680", "685"} {
		if !byFunc[code].TransactionDate.Equal(fileDate) {
			t.Errorf("%s transaction_date=%s want %s", code, byFunc[code].TransactionDate.Format("2006-01-02"), fileDate.Format("2006-01-02"))
		}
	}
	if byFunc["680"].PDS["0381"] == "" || byFunc["685"].PDS["0396"] == "" {
		t.Errorf("expected settlement PDS amounts, 680 0381=%q 685 0396=%q", byFunc["680"].PDS["0381"], byFunc["685"].PDS["0396"])
	}

	// Header/trailer must not be registered as card transactions.
	for _, tx := range repo.stored {
		if tx.FunctionCode == "697" || tx.FunctionCode == "695" {
			t.Errorf("header/trailer should not be upserted: %s", tx.FunctionCode)
		}
	}

	// Re-upload should report duplicates.
	summary2, err := svc.ProcessReportFile(context.Background(), "TT113T0.2026-09-29-02-20-05.001", bytes.NewReader(data))
	if err != nil {
		t.Fatalf("re-upload: %v", err)
	}
	if summary2.Status != "DUPLICATE" {
		t.Errorf("re-upload status=%s want DUPLICATE", summary2.Status)
	}
	if summary2.DuplicateRecords != 2 || summary2.InsertedRecords != 0 {
		t.Errorf("re-upload inserted=%d duplicates=%d", summary2.InsertedRecords, summary2.DuplicateRecords)
	}
}

func TestProcessReportFile_CorruptEmpty(t *testing.T) {
	repo := newStubIPMRepo()
	svc := NewMastercardIPMService(repo)
	summary, err := svc.ProcessReportFile(context.Background(), "empty.bin", bytes.NewReader([]byte{0, 0, 0, 0, 0x40, 0x40}))
	if err == nil {
		t.Fatal("expected error for corrupt file")
	}
	if summary == nil || summary.Status != "FAILED" {
		t.Fatalf("expected FAILED summary, got %+v", summary)
	}
}

func TestDateFromIPMFileID(t *testing.T) {
	got := dateFromIPMFileID("0032609290000003445702201")
	want := time.Date(2026, time.September, 29, 0, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Fatalf("date=%s want %s", got, want)
	}
	if !dateFromIPMFileID("").IsZero() || !dateFromIPMFileID("003999999").IsZero() {
		t.Fatal("invalid file ids should not produce a date")
	}
}

func TestClassifyIPMMessage(t *testing.T) {
	cases := []struct {
		mti, fc, want string
	}{
		{"1644", "697", model.IPMMessageHeader},
		{"1644", "695", model.IPMMessageTrailer},
		{"1644", "680", model.IPMMessageSettlementSummary},
		{"1644", "685", model.IPMMessageSettlementSummary},
		{"1240", "200", model.IPMMessageFinancial},
		{"1644", "900", model.IPMMessageOther},
	}
	for _, c := range cases {
		if got := classifyIPMMessage(c.mti, c.fc); got != c.want {
			t.Errorf("classify(%s,%s)=%s want %s", c.mti, c.fc, got, c.want)
		}
	}
}
