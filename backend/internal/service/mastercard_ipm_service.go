package service

import (
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type MastercardIPMService interface {
	ProcessReportFile(ctx context.Context, fileName string, reader io.Reader) (*model.MastercardIPMBatchSummary, error)
	GetByDateRange(ctx context.Context, startDate, endDate time.Time) ([]model.MastercardIPMTransaction, error)
	SearchBySTAN(ctx context.Context, query string) ([]model.MastercardIPMTransaction, error)
	GetBatchRecords(ctx context.Context, batchID string) ([]model.MastercardIPMTransaction, error)
	GetBySTAN(ctx context.Context, stan string) (*model.MastercardIPMTransaction, error)
	GetByPAN(ctx context.Context, pan string) ([]model.MastercardIPMTransaction, error)
	GetBatchSummary(ctx context.Context, batchID string) (*model.MastercardIPMBatchSummary, error)
	ListBatchSummaries(ctx context.Context, limit int64) ([]model.MastercardIPMBatchSummary, error)
}

type mastercardIPMService struct {
	repo repository.MastercardIPMRepository
}

func NewMastercardIPMService(repo repository.MastercardIPMRepository) MastercardIPMService {
	return &mastercardIPMService{repo: repo}
}

// ─────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────

func (s *mastercardIPMService) GetByDateRange(ctx context.Context, startDate, endDate time.Time) ([]model.MastercardIPMTransaction, error) {
	if endDate.Before(startDate) {
		return nil, fmt.Errorf("endDate must be on or after startDate")
	}

	start := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, time.UTC)
	end := time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 23, 59, 59, 999999999, time.UTC)

	txs, err := s.repo.FindByDateRange(ctx, start, end)
	if err != nil {
		return nil, fmt.Errorf("get by date range: %w", err)
	}
	return maskIPMTransactions(txs), nil
}

func (s *mastercardIPMService) GetBatchRecords(ctx context.Context, batchID string) ([]model.MastercardIPMTransaction, error) {
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

	return maskIPMTransactions(txs), nil
}

const maxIPMSearchResults = 100

func (s *mastercardIPMService) SearchBySTAN(ctx context.Context, query string) ([]model.MastercardIPMTransaction, error) {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return []model.MastercardIPMTransaction{}, nil
	}

	txs, err := s.repo.FindBySTANPrefix(ctx, trimmed, maxIPMSearchResults)
	if err != nil {
		return nil, fmt.Errorf("search by STAN: %w", err)
	}

	return maskIPMTransactions(txs), nil
}

func (s *mastercardIPMService) GetBySTAN(ctx context.Context, stan string) (*model.MastercardIPMTransaction, error) {
	if strings.TrimSpace(stan) == "" {
		return nil, fmt.Errorf("stan is required")
	}

	tx, err := s.repo.FindBySTAN(ctx, stan)
	if err != nil {
		return nil, fmt.Errorf("get by STAN: %w", err)
	}
	if tx == nil {
		return nil, nil
	}
	masked := maskIPMTransaction(*tx)
	return &masked, nil
}

func (s *mastercardIPMService) GetByPAN(ctx context.Context, pan string) ([]model.MastercardIPMTransaction, error) {
	if strings.TrimSpace(pan) == "" {
		return nil, fmt.Errorf("pan is required")
	}

	txs, err := s.repo.FindByPAN(ctx, pan)
	if err != nil {
		return nil, fmt.Errorf("get by PAN: %w", err)
	}
	return maskIPMTransactions(txs), nil
}

// maskPAN keeps BIN (first 6) + last 4 when possible; shorter values are fully redacted.
func maskPAN(pan string) string {
	pan = strings.TrimSpace(pan)
	if pan == "" {
		return ""
	}
	digits := make([]rune, 0, len(pan))
	for _, r := range pan {
		if r >= '0' && r <= '9' {
			digits = append(digits, r)
		}
	}
	n := len(digits)
	if n == 0 {
		return "****"
	}
	if n <= 10 {
		return strings.Repeat("*", n)
	}
	return string(digits[:6]) + strings.Repeat("*", n-10) + string(digits[n-4:])
}

func maskIPMTransaction(tx model.MastercardIPMTransaction) model.MastercardIPMTransaction {
	tx.PAN = maskPAN(tx.PAN)
	return tx
}

func maskIPMTransactions(txs []model.MastercardIPMTransaction) []model.MastercardIPMTransaction {
	if len(txs) == 0 {
		return txs
	}
	out := make([]model.MastercardIPMTransaction, len(txs))
	for i := range txs {
		out[i] = maskIPMTransaction(txs[i])
	}
	return out
}

func (s *mastercardIPMService) GetBatchSummary(ctx context.Context, batchID string) (*model.MastercardIPMBatchSummary, error) {
	if strings.TrimSpace(batchID) == "" {
		return nil, fmt.Errorf("batchID is required")
	}

	summary, err := s.repo.FindBatchSummaryByID(ctx, batchID)
	if err != nil {
		return nil, fmt.Errorf("get batch summary: %w", err)
	}
	return summary, nil
}

func (s *mastercardIPMService) ListBatchSummaries(ctx context.Context, limit int64) ([]model.MastercardIPMBatchSummary, error) {
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

func (s *mastercardIPMService) ProcessReportFile(ctx context.Context, fileName string, reader io.Reader) (*model.MastercardIPMBatchSummary, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		summary := &model.MastercardIPMBatchSummary{
			ID:           primitive.NewObjectID(),
			FileName:     fileName,
			TotalRecords: 0,
			ProcessedAt:  time.Now().UTC(),
			CreatedAt:    time.Now().UTC(),
			Status:       "FAILED",
			ErrorMessage: fmt.Sprintf("failed reading file stream: %v", err),
		}
		_ = s.repo.SaveBatchSummary(ctx, summary)
		return summary, fmt.Errorf("error reading IPM file: %w", err)
	}

	parsed := parseIPMFile(data, fileName)

	now := time.Now().UTC()
	summary := &model.MastercardIPMBatchSummary{
		ID:             primitive.NewObjectID(),
		FileName:       fileName,
		ParsedMessages: len(parsed),
		ProcessedAt:    now,
		CreatedAt:      now,
		Status:         "COMPLETED",
	}

	var header *model.MastercardIPMTransaction
	var trailer *model.MastercardIPMTransaction
	registrable := make([]model.MastercardIPMTransaction, 0, len(parsed))

	for i := range parsed {
		msg := &parsed[i]
		switch msg.MessageType {
		case model.IPMMessageHeader:
			header = msg
			if msg.FileID != "" {
				summary.FileID = msg.FileID
			}
		case model.IPMMessageTrailer:
			trailer = msg
			if summary.FileID == "" && msg.FileID != "" {
				summary.FileID = msg.FileID
			}
		case model.IPMMessageSettlementSummary, model.IPMMessageFinancial:
			registrable = append(registrable, *msg)
		}
	}

	// Propagate PDS 0105 file id from header onto registrable records and
	// rebuild business keys so upserts stay stable across re-uploads.
	fileID := summary.FileID
	for i := range registrable {
		if registrable[i].FileID == "" && fileID != "" {
			registrable[i].FileID = fileID
		}
		registrable[i].BusinessKey = buildIPMBusinessKey(
			registrable[i].FileID,
			registrable[i].MessageNumber,
			registrable[i].FunctionCode,
		)
		// Settlement summaries usually have no DE12/DE13. PDS 0105 (often only
		// on the header, copied above) encodes the file reference date.
		if registrable[i].TransactionDate.IsZero() {
			registrable[i].TransactionDate = dateFromIPMFileID(registrable[i].FileID)
		}
		registrable[i].BatchID = summary.ID
	}

	_ = trailer // parsed for validation; trailer message count is advisory

	if header == nil && len(registrable) == 0 {
		summary.Status = "FAILED"
		summary.ErrorMessage = "corrupt or empty IPM file: no header and no settlement/financial records"
		summary.TotalRecords = 0
		summary.ParsedRecords = 0
		_ = s.repo.SaveBatchSummary(ctx, summary)
		return summary, fmt.Errorf("%s", summary.ErrorMessage)
	}

	summary.ParsedRecords = len(registrable)
	summary.TotalRecords = len(registrable)

	if len(registrable) > 0 {
		inserted, duplicates, err := s.repo.UpsertTransactions(ctx, registrable)
		if err != nil {
			summary.Status = "FAILED"
			summary.ErrorMessage = fmt.Sprintf("bulk insert failed: %v", err)
			_ = s.repo.SaveBatchSummary(ctx, summary)
			return summary, fmt.Errorf("failed to store IPM transactions: %w", err)
		}

		summary.InsertedRecords = inserted
		summary.DuplicateRecords = duplicates

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
// IPM FILE PARSER
// ─────────────────────────────────────────────

// ipmDEKind describes how a data element length is encoded.
type ipmDEKind int

const (
	ipmFixed ipmDEKind = iota
	ipmLLVAR
	ipmLLLVAR
)

type ipmDESpec struct {
	kind   ipmDEKind
	length int // fixed length only
}

// Mastercard IPM (ASCII) DE lengths covering clearing admin messages and
// common presentment DEs. Unknown DEs cause that record to be skipped.
var ipmDELengthTable = map[int]ipmDESpec{
	2:   {ipmLLVAR, 0},
	3:   {ipmFixed, 6},
	4:   {ipmFixed, 12},
	5:   {ipmFixed, 12},
	6:   {ipmFixed, 12},
	7:   {ipmFixed, 10},
	9:   {ipmFixed, 8},
	10:  {ipmFixed, 8},
	11:  {ipmFixed, 6},
	12:  {ipmFixed, 12}, // IPM n-12 YYMMDDhhmmss
	13:  {ipmFixed, 4},
	14:  {ipmFixed, 4},
	15:  {ipmFixed, 6},
	16:  {ipmFixed, 4},
	17:  {ipmFixed, 4},
	18:  {ipmFixed, 4},
	19:  {ipmFixed, 3},
	20:  {ipmFixed, 3},
	21:  {ipmFixed, 3},
	22:  {ipmFixed, 12}, // IPM POS entry mode
	23:  {ipmFixed, 3},
	24:  {ipmFixed, 3}, // Function code
	25:  {ipmFixed, 4}, // Message reason code
	26:  {ipmFixed, 4},
	27:  {ipmFixed, 1},
	28:  {ipmFixed, 9},
	29:  {ipmFixed, 9},
	30:  {ipmFixed, 24},
	31:  {ipmLLVAR, 0},
	32:  {ipmLLVAR, 0},
	33:  {ipmLLVAR, 0},
	34:  {ipmLLVAR, 0},
	35:  {ipmLLVAR, 0},
	36:  {ipmLLLVAR, 0},
	37:  {ipmFixed, 12},
	38:  {ipmFixed, 6},
	39:  {ipmFixed, 3},
	40:  {ipmFixed, 3},
	41:  {ipmFixed, 8},
	42:  {ipmFixed, 15},
	43:  {ipmFixed, 40}, // IPM fixed 40 (not LLVAR)
	44:  {ipmLLVAR, 0},
	45:  {ipmLLVAR, 0},
	46:  {ipmLLLVAR, 0},
	47:  {ipmLLLVAR, 0},
	48:  {ipmLLLVAR, 0}, // PDS TLV container
	49:  {ipmFixed, 3},
	50:  {ipmFixed, 3},
	51:  {ipmFixed, 3},
	54:  {ipmLLLVAR, 0},
	55:  {ipmLLLVAR, 0},
	62:  {ipmLLLVAR, 0},
	63:  {ipmLLLVAR, 0},
	71:  {ipmFixed, 8}, // Message number
	72:  {ipmLLLVAR, 0},
	73:  {ipmFixed, 6},
	93:  {ipmLLVAR, 0}, // Destination institution
	94:  {ipmLLVAR, 0},
	95:  {ipmFixed, 10},
	96:  {ipmFixed, 8},
	100: {ipmLLVAR, 0}, // Originator institution
	111: {ipmLLLVAR, 0},
	123: {ipmLLLVAR, 0},
	124: {ipmLLLVAR, 0},
	125: {ipmLLLVAR, 0},
	127: {ipmLLLVAR, 0},
}

// parseIPMFile parses a binary Mastercard IPM file into messages.
//
// File structure per message:
//   - 4-byte big-endian length prefix (excludes the 4 length bytes)
//   - 4-byte ASCII MTI
//   - 8- or 16-byte bitmap (16 when bit 1 / DE1 is set)
//   - ASCII data elements
//
// Trailing zero lengths and EBCDIC/ASCII space padding are ignored.
func parseIPMFile(data []byte, fileName string) []model.MastercardIPMTransaction {
	var messages []model.MastercardIPMTransaction
	offset := 0

	for offset < len(data) {
		if offset+4 > len(data) {
			break
		}

		recordLen := binary.BigEndian.Uint32(data[offset : offset+4])

		// Stop on zero / invalid length or padding (0x00 / 0x40 runs).
		if recordLen == 0 || recordLen > 10000 {
			break
		}
		if offset+4+int(recordLen) > len(data) {
			break
		}

		record := data[offset+4 : offset+4+int(recordLen)]
		offset += 4 + int(recordLen)

		tx, err := parseIPMRecord(record, fileName)
		if err != nil || tx == nil {
			// Length prefix keeps us aligned; skip a bad record rather than
			// aborting the whole file.
			continue
		}
		messages = append(messages, *tx)
	}

	return messages
}

// parseIPMRecord parses a single IPM message body (length prefix already stripped).
func parseIPMRecord(record []byte, fileName string) (*model.MastercardIPMTransaction, error) {
	if len(record) < 12 {
		return nil, fmt.Errorf("record too short: %d", len(record))
	}

	mti := string(record[0:4])
	if !isDigits(mti) {
		return nil, fmt.Errorf("invalid MTI %q", mti)
	}

	primary := record[4]
	bitmapLen := 8
	if primary&0x80 != 0 {
		bitmapLen = 16
	}
	if len(record) < 4+bitmapLen {
		return nil, fmt.Errorf("record shorter than MTI+bitmap")
	}

	bitmap := record[4 : 4+bitmapLen]
	dePresent := presentDEs(bitmap)

	fields, remain, err := readIPMFields(record[4+bitmapLen:], dePresent)
	if err != nil {
		return nil, err
	}
	_ = remain // remain==0 for well-formed clearing admin messages

	pds := parsePDS(fields[48])
	fileID := pds["0105"]
	functionCode := fields[24]
	messageNumber := fields[71]
	messageType := classifyIPMMessage(mti, functionCode)

	tx := &model.MastercardIPMTransaction{
		ID:                       primitive.NewObjectID(),
		MTI:                      mti,
		FunctionCode:             functionCode,
		MessageNumber:            messageNumber,
		MessageType:              messageType,
		FileID:                   fileID,
		FileName:                 fileName,
		CreatedAt:                time.Now().UTC(),
		MessageReasonCode:        fields[25],
		DestinationInstitutionID: fields[93],
		OriginatorInstitutionID:  fields[100],
		AcquirerID:               fields[32],
		CurrencyCode:             fields[49],
		SettlementCurrency:       fields[50],
		PDS:                      pds,
		PAN:                      fields[2],
		ProcessingCode:           fields[3],
		Amount:                   parseIPMAmount(fields[4]),
		TransmissionDateTime:     fields[7],
		STAN:                     fields[11],
		LocalTime:                fields[12],
		LocalDate:                fields[13],
		MerchantType:             fields[18],
		POSEntryMode:             fields[22],
		TerminalID:               fields[41],
		CardAcceptorID:           fields[42],
		CardAcceptorName:         strings.TrimSpace(fields[43]),
		BusinessKey:              buildIPMBusinessKey(fileID, messageNumber, functionCode),
	}

	tx.TransactionDate = deriveIPMDate(fields[13], fields[12])
	if tx.TransactionDate.IsZero() {
		tx.TransactionDate = dateFromIPMFileID(fileID)
	}

	return tx, nil
}

func presentDEs(bitmap []byte) []int {
	present := make([]int, 0, 16)
	for byteIdx := 0; byteIdx < len(bitmap); byteIdx++ {
		b := bitmap[byteIdx]
		for bitIdx := 0; bitIdx < 8; bitIdx++ {
			if b&(1<<(7-bitIdx)) != 0 {
				deNum := byteIdx*8 + bitIdx + 1
				present = append(present, deNum)
			}
		}
	}
	return present
}

func readIPMFields(data []byte, dePresent []int) (map[int]string, int, error) {
	fields := make(map[int]string)
	pos := 0

	for _, deNum := range dePresent {
		if deNum == 1 {
			// Secondary bitmap indicator — already consumed via bitmap length.
			continue
		}

		spec, ok := ipmDELengthTable[deNum]
		if !ok {
			return fields, len(data) - pos, fmt.Errorf("unsupported DE %d (cannot continue this record)", deNum)
		}

		switch spec.kind {
		case ipmFixed:
			if pos+spec.length > len(data) {
				return fields, len(data) - pos, fmt.Errorf("truncated DE %d", deNum)
			}
			fields[deNum] = string(data[pos : pos+spec.length])
			pos += spec.length
		case ipmLLVAR:
			if pos+2 > len(data) {
				return fields, len(data) - pos, fmt.Errorf("truncated LLVAR length for DE %d", deNum)
			}
			length, err := strconv.Atoi(string(data[pos : pos+2]))
			if err != nil || length < 0 {
				return fields, len(data) - pos, fmt.Errorf("bad LLVAR length for DE %d", deNum)
			}
			pos += 2
			if pos+length > len(data) {
				return fields, len(data) - pos, fmt.Errorf("truncated LLVAR data for DE %d", deNum)
			}
			fields[deNum] = string(data[pos : pos+length])
			pos += length
		case ipmLLLVAR:
			if pos+3 > len(data) {
				return fields, len(data) - pos, fmt.Errorf("truncated LLLVAR length for DE %d", deNum)
			}
			length, err := strconv.Atoi(string(data[pos : pos+3]))
			if err != nil || length < 0 {
				return fields, len(data) - pos, fmt.Errorf("bad LLLVAR length for DE %d", deNum)
			}
			pos += 3
			if pos+length > len(data) {
				return fields, len(data) - pos, fmt.Errorf("truncated LLLVAR data for DE %d", deNum)
			}
			fields[deNum] = string(data[pos : pos+length])
			pos += length
		}
	}

	return fields, len(data) - pos, nil
}

// parsePDS parses Mastercard Private Data Sub-element TLV from DE48:
// 4-digit tag + 3-digit length + data.
func parsePDS(de48 string) map[string]string {
	if de48 == "" {
		return nil
	}
	pds := make(map[string]string)
	i := 0
	for i+7 <= len(de48) {
		tag := de48[i : i+4]
		length, err := strconv.Atoi(de48[i+4 : i+7])
		if err != nil || length < 0 || i+7+length > len(de48) {
			break
		}
		i += 7
		pds[tag] = de48[i : i+length]
		i += length
	}
	if len(pds) == 0 {
		return nil
	}
	return pds
}

func classifyIPMMessage(mti, functionCode string) string {
	switch functionCode {
	case "697":
		return model.IPMMessageHeader
	case "695":
		return model.IPMMessageTrailer
	}

	// File currency / financial-position style clearing totals.
	if len(functionCode) == 3 && functionCode[0] == '6' && functionCode[1] == '8' {
		return model.IPMMessageSettlementSummary
	}

	switch mti {
	case "1240", "1442", "1740", "1644":
		// 1644 with non-admin function codes may still carry financial data in
		// some files; treat unknown 1644 as OTHER unless it looked like 68x.
		if mti != "1644" {
			return model.IPMMessageFinancial
		}
	}

	if strings.HasPrefix(mti, "12") || strings.HasPrefix(mti, "14") || strings.HasPrefix(mti, "17") {
		return model.IPMMessageFinancial
	}

	return model.IPMMessageOther
}

func buildIPMBusinessKey(fileID, messageNumber, functionCode string) string {
	fileID = strings.TrimSpace(fileID)
	messageNumber = strings.TrimSpace(messageNumber)
	functionCode = strings.TrimSpace(functionCode)
	if fileID == "" && messageNumber == "" && functionCode == "" {
		return ""
	}
	return fileID + "|" + messageNumber + "|" + functionCode
}

func parseIPMAmount(val string) int64 {
	if val == "" {
		return 0
	}
	clean := strings.TrimLeft(val, "0")
	if clean == "" {
		return 0
	}
	v, err := strconv.ParseInt(clean, 10, 64)
	if err != nil {
		return 0
	}
	return v
}

// deriveIPMDate prefers DE13 (MMDD); falls back to DE12 YYMMDDhhmmss prefix.
func deriveIPMDate(mmdd, local12 string) time.Time {
	if len(mmdd) == 4 {
		month, err1 := strconv.Atoi(mmdd[:2])
		day, err2 := strconv.Atoi(mmdd[2:])
		if err1 == nil && err2 == nil && month >= 1 && month <= 12 && day >= 1 && day <= 31 {
			year := time.Now().UTC().Year()
			return time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
		}
	}
	if len(local12) >= 6 {
		yy, err1 := strconv.Atoi(local12[0:2])
		month, err2 := strconv.Atoi(local12[2:4])
		day, err3 := strconv.Atoi(local12[4:6])
		if err1 == nil && err2 == nil && err3 == nil {
			year := 2000 + yy
			return time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
		}
	}
	return time.Time{}
}

// dateFromIPMFileID reads the file reference date from PDS 0105.
// Layout is n-3 file type, n-6 YYMMDD, n-11 processor id, n-5 sequence
// (0032609290000003445702201 -> 2026-09-29). Shorter values are ignored.
func dateFromIPMFileID(fileID string) time.Time {
	fileID = strings.TrimSpace(fileID)
	if len(fileID) < 9 {
		return time.Time{}
	}
	yymmdd := fileID[3:9]
	if !isDigits(yymmdd) {
		return time.Time{}
	}
	yy, err1 := strconv.Atoi(yymmdd[0:2])
	month, err2 := strconv.Atoi(yymmdd[2:4])
	day, err3 := strconv.Atoi(yymmdd[4:6])
	if err1 != nil || err2 != nil || err3 != nil {
		return time.Time{}
	}
	if month < 1 || month > 12 || day < 1 || day > 31 {
		return time.Time{}
	}
	return time.Date(2000+yy, time.Month(month), day, 0, 0, 0, 0, time.UTC)
}

func isDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
