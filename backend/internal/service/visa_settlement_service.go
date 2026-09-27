package service

import (
	"context"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type VisaSettlementService interface {
	// Ingest
	ProcessReportFile(ctx context.Context, fileName string, reader io.Reader) (*model.SettlementBatchSummary, error)

	// Fetch
	GetByDateRange(ctx context.Context, startDate, endDate time.Time) ([]model.VisaSettlementTransaction, error)
	// SearchByTransactionID returns records whose transaction id starts with
	// the query, so a truncated id can still be found.
	SearchByTransactionID(ctx context.Context, query string) ([]model.VisaSettlementTransaction, error)
	// GetBatchRecords returns the records captured by one upload.
	GetBatchRecords(ctx context.Context, batchID string) ([]model.VisaSettlementTransaction, error)
	GetByTransactionID(ctx context.Context, transactionID string) (*model.VisaSettlementTransaction, error)
	GetByAccountNumber(ctx context.Context, accountNumber string) ([]model.VisaSettlementTransaction, error)
	GetBatchSummary(ctx context.Context, batchID string) (*model.SettlementBatchSummary, error)
	ListBatchSummaries(ctx context.Context, limit int64) ([]model.SettlementBatchSummary, error)
}

type visaSettlementService struct {
	repo repository.VisaSettlementRepository
}

func NewVisaSettlementService(repo repository.VisaSettlementRepository) VisaSettlementService {
	return &visaSettlementService{
		repo: repo,
	}
}

var gapRe = regexp.MustCompile(`\s{4,}`)

// ─────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────

func (s *visaSettlementService) GetByDateRange(ctx context.Context, startDate, endDate time.Time) ([]model.VisaSettlementTransaction, error) {
	if endDate.Before(startDate) {
		return nil, fmt.Errorf("endDate must be on or after startDate")
	}

	start := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, time.UTC)
	end := time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 23, 59, 59, 999999999, time.UTC)

	txs, err := s.repo.FindByDateRange(ctx, start, end)
	if err != nil {
		return nil, fmt.Errorf("get by date range: %w", err)
	}
	return txs, nil
}

// GetBatchRecords returns the records captured by one upload.
//
// Records written before batch provenance existed carry no batch_id, so an
// older upload legitimately returns nothing. That is reported as an empty set
// rather than an error, because it is a data age problem, not a bad request.
func (s *visaSettlementService) GetBatchRecords(ctx context.Context, batchID string) ([]model.VisaSettlementTransaction, error) {
	if strings.TrimSpace(batchID) == "" {
		return nil, fmt.Errorf("batchID is required")
	}

	oid, err := primitive.ObjectIDFromHex(batchID)
	if err != nil {
		return nil, fmt.Errorf("invalid batch id: %w", err)
	}

	txs, err := s.repo.FindByBatchID(ctx, oid)
	if err != nil {
		return nil, fmt.Errorf("get records by batch id: %w", err)
	}

	return txs, nil
}

// maxTransactionSearchResults caps a search so a one character prefix cannot
// pull back the whole collection into a table.
const maxTransactionSearchResults = 100

// SearchByTransactionID returns records whose transaction id starts with query.
//
// Matching on a prefix rather than the whole id is deliberate: the ids are long
// and are usually read off a report or an exception list, so a truncated one is
// the common case. An exact match is included, since a full id is a prefix of
// itself.
func (s *visaSettlementService) SearchByTransactionID(ctx context.Context, query string) ([]model.VisaSettlementTransaction, error) {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return []model.VisaSettlementTransaction{}, nil
	}

	// The trimmed value is what reaches the repository, so the prefix it builds
	// cannot carry stray whitespace that the user pasted in.
	txs, err := s.repo.FindByTransactionIDPrefix(ctx, trimmed, maxTransactionSearchResults)
	if err != nil {
		return nil, fmt.Errorf("search by transaction id: %w", err)
	}

	return txs, nil
}

func (s *visaSettlementService) GetByTransactionID(ctx context.Context, transactionID string) (*model.VisaSettlementTransaction, error) {
	if strings.TrimSpace(transactionID) == "" {
		return nil, fmt.Errorf("transactionID is required")
	}

	tx, err := s.repo.FindByTransactionID(ctx, transactionID)
	if err != nil {
		return nil, fmt.Errorf("get by transaction id: %w", err)
	}
	return tx, nil
}

func (s *visaSettlementService) GetByAccountNumber(ctx context.Context, accountNumber string) ([]model.VisaSettlementTransaction, error) {
	if strings.TrimSpace(accountNumber) == "" {
		return nil, fmt.Errorf("accountNumber is required")
	}

	txs, err := s.repo.FindByAccountNumber(ctx, accountNumber)
	if err != nil {
		return nil, fmt.Errorf("get by account number: %w", err)
	}
	return txs, nil
}

func (s *visaSettlementService) GetBatchSummary(ctx context.Context, batchID string) (*model.SettlementBatchSummary, error) {
	if strings.TrimSpace(batchID) == "" {
		return nil, fmt.Errorf("batchID is required")
	}

	summary, err := s.repo.FindBatchSummaryByID(ctx, batchID)
	if err != nil {
		return nil, fmt.Errorf("get batch summary: %w", err)
	}
	return summary, nil
}

func (s *visaSettlementService) ListBatchSummaries(ctx context.Context, limit int64) ([]model.SettlementBatchSummary, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	summaries, err := s.repo.ListBatchSummaries(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("list batch summaries: %w", err)
	}
	return summaries, nil
}

// ─────────────────────────────────────────────
// INGEST
// ─────────────────────────────────────────────

func (s *visaSettlementService) ProcessReportFile(ctx context.Context, fileName string, reader io.Reader) (*model.SettlementBatchSummary, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		summary := &model.SettlementBatchSummary{
			ID:           primitive.NewObjectID(),
			FileName:     fileName,
			TotalRecords: 0,
			ProcessedAt:  time.Now().UTC(),
			CreatedAt:    time.Now().UTC(),
			Status:       "FAILED",
			ErrorMessage: fmt.Sprintf("failed reading file stream: %v", err),
		}
		_ = s.repo.SaveBatchSummary(ctx, summary)
		return summary, fmt.Errorf("error reading settlement file: %w", err)
	}

	content := string(data)

	// Strip form-feed / CR
	content = strings.Map(func(r rune) rune {
		if r == '\r' || r == '\f' {
			return -1
		}
		return r
	}, content)

	reportID, cpd, systemDate := extractHeaders(content)

	chunks := strings.Split(content, "TCR 0 Record")
	txs := make([]model.VisaSettlementTransaction, 0, len(chunks))

	for _, chunk := range chunks[1:] {
		idx := strings.Index(chunk, "TCR 1 Record")
		if idx < 0 {
			continue
		}
		tcr0Text := chunk[:idx]
		tcr1Text := chunk[idx+len("TCR 1 Record"):]

		if next := strings.Index(tcr1Text, "TCR 0 Record"); next >= 0 {
			tcr1Text = tcr1Text[:next]
		}
		if next := strings.Index(tcr1Text, "TRANSACTION TOTAL"); next >= 0 {
			tcr1Text = tcr1Text[:next]
		}

		f0 := parseBlock(tcr0Text)
		f1 := parseBlock(tcr1Text)

		acct := getField(f0, "Account Number")
		acctExt := getField(f0, "Account Number Extension")
		purchaseDate := getField(f1, "Purchase Date")

		tx := model.VisaSettlementTransaction{
			ID:                    primitive.NewObjectID(),
			ReportID:              reportID,
			CPD:                   cpd,
			SystemDate:            systemDate,
			PageNumber:            1,
			CreatedAt:             time.Now().UTC(),
			DestinationIdentifier: getField(f0, "Destination Identifier"),
			SourceIdentifier:      getField(f0, "Source Identifier"),
			RecordIdentifier:      getField(f0, "Record Identifier"),
			TranCode:              getField(f0, "Tran Code of financial tr", "Tran Code"),
			TransactionID:         getField(f0, "Transaction ID"),
			AccountNumber:         acct + acctExt,
			AcquirerRefNumber:     getField(f0, "Acquirer Reference Number"),
			CardAcceptorID:        getField(f0, "Card Acceptor ID"),
			TerminalID:            getField(f0, "Terminal ID"),
			SourceAmount:          parseRawAmount(getField(f0, "Source Amount")),
			SourceCurrencyCode:    getField(f0, "Source Currency Code"),
			SettlementAmount:      parseRawAmount(getField(f0, "Settlement amount - Inter", "Settlement amount")),
			SettlementAmountSign:  getField(f0, "Settlement amount Sign"),
			SettlementCurrency:    getField(f0, "Settlement Currency"),
			InterchangeFeeAmount:  parseRawAmount(getField(f1, "Interchange Fee Amount")),
			InterchangeFeeSign:    getField(f1, "Interchange Fee Sign"),
			MerchantName:          getField(f1, "Merchant Name"),
			MerchantCategoryCode:  getField(f1, "Merchant Category Code"),
			FeeDescriptor:         getField(f1, "Fee Descriptor"),
			BIIUniqueFileID:       getField(f1, "BII Unique File ID"),
			PurchaseDate:          purchaseDate,
			TransactionDate:       parsePurchaseDate(purchaseDate, cpd),
		}
		txs = append(txs, tx)
	}

	// The batch identifier is minted before the records are written so every
	// captured record can point back at the upload that produced it. The same
	// summary is then saved, keeping the id on the success and failure paths
	// identical so a failed ingest is still traceable.
	now := time.Now().UTC()
	summary := &model.SettlementBatchSummary{
		ID:            primitive.NewObjectID(),
		FileName:      fileName,
		TotalRecords:  len(txs),
		ParsedRecords: len(txs),
		ProcessedAt:   now,
		CreatedAt:     now,
		Status:        "COMPLETED",
	}

	for i := range txs {
		txs[i].BatchID = summary.ID
	}

	// Records are upserted on their transaction id, so uploading the same file
	// again updates what is already stored rather than duplicating it.
	if len(txs) > 0 {
		inserted, duplicates, err := s.repo.UpsertTransactions(ctx, txs)
		if err != nil {
			summary.Status = "FAILED"
			summary.ErrorMessage = fmt.Sprintf("bulk insert failed: %v", err)
			_ = s.repo.SaveBatchSummary(ctx, summary)
			return summary, fmt.Errorf("failed to store settlement transactions: %w", err)
		}

		summary.InsertedRecords = inserted
		summary.DuplicateRecords = duplicates
		// TotalRecords stays the number of records the file held, so a
		// re-upload is visibly the same file rather than a smaller one.
		summary.TotalRecords = len(txs)

		if inserted == 0 && duplicates > 0 {
			summary.Status = "DUPLICATE"
		}
	}

	if err := s.repo.SaveBatchSummary(ctx, summary); err != nil {
		return summary, fmt.Errorf("failed to save batch summary: %w", err)
	}

	return summary, nil
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

func extractHeaders(content string) (reportID, cpd, systemDate string) {
	if strings.Contains(content, "CPD") {
		reportID = "CPD"
	}
	if m := regexp.MustCompile(`SYSTEM DATE\s+(\S+)`).FindStringSubmatch(content); len(m) == 2 {
		systemDate = m[1]
	}
	if m := regexp.MustCompile(`CPD\s+(\S+)`).FindStringSubmatch(content); len(m) == 2 {
		cpd = m[1]
	}
	if reportID == "" {
		if m := regexp.MustCompile(`REPORT\s+(\S+)`).FindStringSubmatch(content); len(m) == 2 {
			reportID = m[1]
		}
	}
	return
}

func parseBlock(text string) map[string]string {
	fields := make(map[string]string)
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimRight(line, "\r")
		if len(strings.TrimSpace(line)) < 10 || strings.Contains(line, "Clearing and Settlement Advice") {
			continue
		}

		parts := []string{strings.TrimSpace(line)}
		if len(line) > 40 {
			if loc := gapRe.FindStringIndex(line[40:]); loc != nil {
				pos := 40 + loc[0]
				parts = []string{
					strings.TrimSpace(line[:pos]),
					strings.TrimSpace(line[pos:]),
				}
			}
		}

		for _, part := range parts {
			if part == "" {
				continue
			}
			if idx := strings.Index(part, "  "); idx > 0 {
				label := collapseSpaces(part[:idx])
				value := strings.TrimSpace(part[idx:])
				if value != "" {
					fields[label] = value
					continue
				}
			}
			if m := regexp.MustCompile(`^(.+\S)\s+(\S{1,3})$`).FindStringSubmatch(part); len(m) == 3 {
				fields[collapseSpaces(m[1])] = m[2]
				continue
			}
			if m := regexp.MustCompile(`^(.+\D)\s*(\d+)$`).FindStringSubmatch(part); len(m) == 3 {
				fields[collapseSpaces(m[1])] = m[2]
			}
		}
	}
	return fields
}

func getField(fields map[string]string, keys ...string) string {
	for _, k := range keys {
		lk := strings.ToLower(k)

		// Exact match first
		for fk, fv := range fields {
			if strings.ToLower(fk) == lk {
				return fv
			}
		}

		// Contains, skip prefix collisions (e.g. Account Number vs Account Number Extension)
		for fk, fv := range fields {
			fkLower := strings.ToLower(fk)
			if !strings.Contains(fkLower, lk) {
				continue
			}
			if strings.HasPrefix(fkLower, lk) && len(fkLower) > len(lk) && fkLower[len(lk)] == ' ' {
				continue
			}
			return fv
		}
	}
	return ""
}

func collapseSpaces(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

func parseRawAmount(val string) float64 {
	if val == "" {
		return 0
	}
	clean := strings.TrimLeft(val, "0")
	if clean == "" {
		return 0
	}
	v, err := strconv.ParseFloat(clean, 64)
	if err != nil {
		return 0
	}
	// Visa amounts have 2 implicit decimal places
	return v / 100.0
}

// parsePurchaseDate turns a "MMDD" purchase date plus the year taken from the
// file's CPD into a time.Time in UTC.
//
// The CPD in these advice files is YY/MM/DD, not DD/MM/YY. A file header reads
// "CPD 26/09/14" for a report processed in September 2026, and the BII unique
// file id on the same records embeds the identical date as the digit run
// "20260914" (408158020260914P010100). The year is therefore the FIRST
// component. Reading the third component instead took the day of the month for
// the year and filed every record in 2014, twelve years early, which left a
// search over any recent date range returning nothing.
func parsePurchaseDate(purchaseMMDD, cpdOrSystemDate string) time.Time {
	if len(purchaseMMDD) != 4 {
		return time.Time{}
	}
	month, err1 := strconv.Atoi(purchaseMMDD[:2])
	day, err2 := strconv.Atoi(purchaseMMDD[2:])
	if err1 != nil || err2 != nil {
		return time.Time{}
	}

	year := time.Now().UTC().Year()
	if parts := strings.Split(cpdOrSystemDate, "/"); len(parts) == 3 {
		// The year is the first component: the CPD is YY/MM/DD.
		if yy, err := strconv.Atoi(parts[0]); err == nil {
			if yy < 100 {
				year = 2000 + yy
			} else {
				year = yy
			}
		}
	}
	return time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
}
