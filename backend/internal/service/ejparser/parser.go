package ejparser

import (
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

var (
	crmBlockRe = regexp.MustCompile(
		`(?s)============TRANSACTION START=============\s*(.*?)\s*============TRANSACTION END=============`,
	)
	ncrBlockRe = regexp.MustCompile(
		`(?s)\*TRANSACTION START\*\s*(.*?)\s*TRANSACTION END`,
	)

	crmCardRe      = regexp.MustCompile(`CARD:;([\dX\*]+)\?`)
	crmHostPanRe   = regexp.MustCompile(`(\d{4}\*{7,14}\d{4})`)
	crmAmountRe    = regexp.MustCompile(`([\d,]+(?:\.\d{2})?)\s+([\d,]+\.\d{2})\s+230`)
	crmAuthRe      = regexp.MustCompile(`AUTHNUM:\s*([\d]*)`)
	crmRespRe      = regexp.MustCompile(`RESPCODE:\s*([\d]+)`)
	crmStatusRe    = regexp.MustCompile(`TXN-STATUS\s*:\s*(SUCCESS|FAILED)`)
	crmTimeRe     = regexp.MustCompile(`(\d{2}:\d{2}:\d{2})`)
	crmAccountOTP = regexp.MustCompile(`CUSTOMER INFORMATION ENTERED`)
	// Digits on the line after CUSTOMER INFORMATION ENTERED (account or OTP).
	crmCustomerAccountRe = regexp.MustCompile(
		`(?mi)CUSTOMER INFORMATION ENTERED[^\n]*\n[ \t]*(\d{4,})\b`,
	)
	// e.g. "11:52:36 CAMERA  1 P20261023115236267.JPG"
	ejCameraRe = regexp.MustCompile(
		`(?i)CAMERA\s+(\d+)\s+(\S+\.(?:JPG|JPEG|PNG|BMP))\b`,
	)

	ncrCardRe   = regexp.MustCompile(`(\d{4}[\*]{4,12}\d{4})`)
	ncrAmountRe = regexp.MustCompile(`([\d,]+\.\d{2})`)
	ncrAuthRe   = regexp.MustCompile(`AUTHNUM:\s*(\d*)`)
	ncrRespRe   = regexp.MustCompile(`RESPCODE:\s*(\d+)`)
	ncrTimeRe   = regexp.MustCompile(`(\d{2}:\d{2}:\d{2})`)
	// NCR device controls like "\x1b[020t" break line counting and display.
	ansiEscapeRe = regexp.MustCompile(`\x1b\[[0-9;]*[A-Za-z]`)

	fileNameRe = regexp.MustCompile(`(?i)^(\d{4})_(\d{2})_(\d{2})_(.+)\.log$`)
)

// NormalizeEJText makes CRM/NCR journal text consistent for parse and display.
// NCR files often use CR-only line endings and embedded ANSI sequences.
// Transformations are length-preserving so byte offsets stay valid for append resume.
func NormalizeEJText(data string) string {
	if data == "" {
		return data
	}
	b := []byte(data)
	for i := 0; i < len(b); i++ {
		if b[i] != '\r' {
			continue
		}
		if i+1 < len(b) && b[i+1] == '\n' {
			b[i] = ' ' // CRLF -> space+LF (one logical newline)
		} else {
			b[i] = '\n' // CR-only (NCR) -> LF
		}
	}
	data = string(b)
	return ansiEscapeRe.ReplaceAllStringFunc(data, func(m string) string {
		return strings.Repeat(" ", len(m))
	})
}

// StatusFromRespCode maps host response codes to SUCCESS/FAILED (NCR has no TXN-STATUS).
func StatusFromRespCode(resp string) string {
	r := strings.TrimSpace(resp)
	if r == "" {
		return ""
	}
	for _, c := range r {
		if c != '0' {
			return "FAILED"
		}
	}
	return "SUCCESS"
}

// DetectAtmType returns CRM or NCR from file contents.
func DetectAtmType(data string) string {
	if strings.Contains(data, "============TRANSACTION START=============") {
		return model.EJAtmTypeCRM
	}
	if strings.Contains(data, "*TRANSACTION START*") {
		return model.EJAtmTypeNCR
	}
	return model.EJAtmTypeCRM
}

// ParseFilename extracts EJ date (YYYY-MM-DD) and terminal id from YYYY_MM_DD_TERMINAL.log.
func ParseFilename(name string) (ejDate, terminalID string, ok bool) {
	base := filepath.Base(name)
	m := fileNameRe.FindStringSubmatch(base)
	if m == nil {
		return "", "", false
	}
	return m[1] + "-" + m[2] + "-" + m[3], strings.TrimSpace(m[4]), true
}

// ParseFile reads and parses one EJ log into searchable transactions.
func ParseFile(path string) (atmType string, txns []model.EJTransaction, err error) {
	atmType, txns, _, _, err = ParseFileFromOffset(path, 0, "", 0)
	return atmType, txns, err
}

// ParseFileFromOffset reads from byte offset and parses only complete transaction blocks.
// newOffset is the absolute file position after the last consumed TRANSACTION END
// (unchanged from offset when the tail has no complete block yet).
// knownAtmType avoids re-detecting on append (pass empty on first parse).
// linesBefore is the newline count in [0, offset) so absolute journal lines stay correct on append.
func ParseFileFromOffset(
	path string,
	offset int64,
	knownAtmType string,
	linesBefore int,
) (atmType string, txns []model.EJTransaction, newOffset int64, newLinesBefore int, err error) {
	if offset < 0 {
		offset = 0
	}
	if linesBefore < 0 {
		linesBefore = 0
	}
	f, err := os.Open(path)
	if err != nil {
		return "", nil, 0, 0, err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return "", nil, 0, 0, err
	}
	size := info.Size()
	if offset > size {
		offset = 0
		linesBefore = 0
	}
	newOffset = offset
	newLinesBefore = linesBefore
	if size == offset {
		atmType = knownAtmType
		if atmType == "" {
			atmType = model.EJAtmTypeCRM
		}
		return atmType, nil, newOffset, newLinesBefore, nil
	}

	raw := make([]byte, size-offset)
	if _, err := f.ReadAt(raw, offset); err != nil {
		return "", nil, 0, 0, err
	}
	data := NormalizeEJText(string(raw))

	atmType = strings.TrimSpace(knownAtmType)
	if atmType == "" {
		atmType = DetectAtmType(data)
		// Append tail may lack START markers; peek the file head once.
		if offset > 0 &&
			!strings.Contains(data, "TRANSACTION START") &&
			!strings.Contains(data, "*TRANSACTION START*") {
			head := make([]byte, minInt64(4096, size))
			if _, rerr := f.ReadAt(head, 0); rerr == nil {
				atmType = DetectAtmType(string(head))
			}
		}
	}

	ejDate, terminalID, ok := ParseFilename(path)
	if !ok {
		terminalID = filepath.Base(filepath.Dir(path))
		ejDate = ""
	}
	filename := filepath.Base(path)

	var parsed []parsedTxn
	var consumed int
	switch atmType {
	case model.EJAtmTypeNCR:
		parsed, consumed = parseNCR(data)
	default:
		parsed, consumed = parseCRM(data)
	}
	newOffset = offset + int64(consumed)
	if consumed > 0 {
		newLinesBefore = linesBefore + strings.Count(data[:consumed], "\n")
	}

	out := make([]model.EJTransaction, 0, len(parsed))
	for _, p := range parsed {
		first4, last4, masked := normalizeCard(p.cardRaw)
		if first4 == "" && last4 == "" && p.authnum == "" && p.amount == 0 {
			continue
		}
		// Skip cardless placeholders.
		if first4 == "9898" && last4 == "0000" {
			first4, last4, masked = "", "", ""
		}
		lineStart := linesBefore + 1 + strings.Count(data[:p.relStart], "\n")
		lineEnd := linesBefore + 1 + strings.Count(data[:maxInt(p.relEnd-1, p.relStart)], "\n")
		out = append(out, model.EJTransaction{
			TerminalID:      terminalID,
			Filename:        filename,
			Path:            path,
			EJDate:          ejDate,
			CardFirst4:      first4,
			CardLast4:       last4,
			CardMasked:      masked,
			Amount:          p.amount,
			AuthNum:         p.authnum,
			RespCode:        p.respcode,
			Status:          p.status,
			StartTime:       p.startTime,
			EndTime:         p.endTime,
			TxnType:         p.txnType,
			AtmType:         atmType,
			CustomerAccount: p.account,
			CameraImages:    p.cameras,
			FileOffset:      offset + int64(p.relStart),
			LineStart:       lineStart,
			LineEnd:         lineEnd,
			RawText:         p.rawText,
		})
	}
	return atmType, out, newOffset, newLinesBefore, nil
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func minInt64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

type parsedTxn struct {
	cardRaw   string
	amount    float64
	authnum   string
	respcode  string
	status    string
	startTime string
	endTime   string
	txnType   string
	account   string
	cameras   []model.EJCameraImage
	relStart  int // byte start of full block within the parsed slice
	relEnd    int // byte end (exclusive) of full block within the parsed slice
	rawText   string
}

// extractCustomerAccount prefers the longest digit value after CUSTOMER INFORMATION ENTERED
// (account numbers are typically longer than OTP / short codes).
func extractCustomerAccount(txn string) string {
	all := crmCustomerAccountRe.FindAllStringSubmatch(txn, -1)
	best := ""
	for _, m := range all {
		if len(m) < 2 {
			continue
		}
		v := strings.TrimSpace(m[1])
		if v == "" {
			continue
		}
		if len(v) > len(best) {
			best = v
		}
	}
	return best
}

// extractCameraImages returns ordered unique CAMERA captures from a journal block.
func extractCameraImages(txn string) []model.EJCameraImage {
	all := ejCameraRe.FindAllStringSubmatch(txn, -1)
	if len(all) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(all))
	out := make([]model.EJCameraImage, 0, len(all))
	for _, m := range all {
		if len(m) < 3 {
			continue
		}
		cam, _ := strconv.Atoi(strings.TrimSpace(m[1]))
		name := strings.TrimSpace(m[2])
		if name == "" {
			continue
		}
		key := strconv.Itoa(cam) + "|" + strings.ToUpper(name)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, model.EJCameraImage{Camera: cam, Filename: name})
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// parseCRM returns complete CRM blocks and the byte end of the last full match.
func parseCRM(data string) ([]parsedTxn, int) {
	locs := crmBlockRe.FindAllStringSubmatchIndex(data, -1)
	out := make([]parsedTxn, 0, len(locs))
	consumed := 0
	for _, loc := range locs {
		if len(loc) < 4 {
			continue
		}
		txn := data[loc[2]:loc[3]]
		consumed = loc[1]
		if strings.TrimSpace(txn) == "" {
			continue
		}
		card := lastMatch(crmCardRe, txn)
		if card == "" {
			card = lastMatch(crmHostPanRe, txn)
		}
		amount := 0.0
		if am := crmAmountRe.FindAllStringSubmatch(txn, -1); len(am) > 0 {
			amount = parseAmount(am[len(am)-1][2])
		}
		times := crmTimeRe.FindAllString(txn, -1)
		start, end := "", ""
		if len(times) > 0 {
			start = times[0]
			end = times[len(times)-1]
		}
		status := ""
		if m := crmStatusRe.FindStringSubmatch(txn); m != nil {
			status = m[1]
		}
		hasOTP := crmAccountOTP.FindStringIndex(txn) != nil
		hasCard := card != ""
		txnType := "Unknown"
		switch {
		case !hasCard && hasOTP:
			txnType = "Cardless"
		case hasCard && hasOTP:
			txnType = "Card Deposit"
		case hasCard && !hasOTP:
			txnType = "Card Withdrawal"
		}
		out = append(out, parsedTxn{
			cardRaw:   card,
			amount:    amount,
			authnum:   strings.TrimSpace(lastMatch(crmAuthRe, txn)),
			respcode:  strings.TrimSpace(lastMatch(crmRespRe, txn)),
			status:    status,
			startTime: start,
			endTime:   end,
			txnType:   txnType,
			account:   extractCustomerAccount(txn),
			cameras:   extractCameraImages(txn),
			relStart:  loc[0],
			relEnd:    loc[1],
			rawText:   data[loc[0]:loc[1]],
		})
	}
	return out, consumeTrailingSpace(data, consumed)
}

// parseNCR returns complete NCR blocks and the byte end of the last full match.
func parseNCR(data string) ([]parsedTxn, int) {
	locs := ncrBlockRe.FindAllStringSubmatchIndex(data, -1)
	out := make([]parsedTxn, 0, len(locs))
	consumed := 0
	for _, loc := range locs {
		if len(loc) < 4 {
			continue
		}
		txn := strings.TrimSpace(data[loc[2]:loc[3]])
		consumed = loc[1]
		if txn == "" {
			continue
		}
		times := ncrTimeRe.FindAllString(txn, -1)
		start, end := "", ""
		if len(times) > 0 {
			start = times[0]
			end = times[len(times)-1]
		}
		// NCR blocks often contain several host lines (0.00 then the real amount).
		// Prefer the last non-zero amount; fall back to the last amount seen.
		amount := ncrAmount(txn)
		resp := strings.TrimSpace(firstMatch(ncrRespRe, txn))
		// Prefer the last card / auth / resp in the block (final financial step).
		card := lastMatch(ncrCardRe, txn)
		if card == "" {
			card = firstMatch(ncrCardRe, txn)
		}
		auth := strings.TrimSpace(lastMatch(ncrAuthRe, txn))
		if auth == "" {
			auth = strings.TrimSpace(firstMatch(ncrAuthRe, txn))
		}
		if lastResp := strings.TrimSpace(lastMatch(ncrRespRe, txn)); lastResp != "" {
			resp = lastResp
		}
		out = append(out, parsedTxn{
			cardRaw:   card,
			amount:    amount,
			authnum:   auth,
			respcode:  resp,
			status:    StatusFromRespCode(resp),
			startTime: start,
			endTime:   end,
			txnType:   "Card Withdrawal",
			account:   extractCustomerAccount(txn),
			cameras:   extractCameraImages(txn),
			relStart:  loc[0],
			relEnd:    loc[1],
			rawText:   data[loc[0]:loc[1]],
		})
	}
	return out, consumeTrailingSpace(data, consumed)
}

func ncrAmount(txn string) float64 {
	all := ncrAmountRe.FindAllStringSubmatch(txn, -1)
	if len(all) == 0 {
		return 0
	}
	lastNonZero := 0.0
	last := 0.0
	for _, am := range all {
		v := parseAmount(am[1])
		last = v
		if v != 0 {
			lastNonZero = v
		}
	}
	if lastNonZero != 0 {
		return lastNonZero
	}
	return last
}

// consumeTrailingSpace advances past whitespace after the last complete block so
// the next append resume does not re-read a stray newline.
func consumeTrailingSpace(data string, consumed int) int {
	for consumed > 0 && consumed < len(data) {
		switch data[consumed] {
		case ' ', '\t', '\n', '\r':
			consumed++
		default:
			return consumed
		}
	}
	return consumed
}

func lastMatch(re *regexp.Regexp, s string) string {
	all := re.FindAllStringSubmatch(s, -1)
	if len(all) == 0 {
		return ""
	}
	return all[len(all)-1][1]
}

func firstMatch(re *regexp.Regexp, s string) string {
	m := re.FindStringSubmatch(s)
	if m == nil {
		return ""
	}
	return m[1]
}

func parseAmount(raw string) float64 {
	cleaned := strings.ReplaceAll(raw, ",", "")
	v, err := strconv.ParseFloat(cleaned, 64)
	if err != nil {
		return 0
	}
	return v
}

// normalizeCard returns first4, last4, and a display mask from CARD or host PAN forms.
// Handles compact digits (92316542) and masked forms (458300XXXXXXXXX7, 9231****6542).
func normalizeCard(raw string) (first4, last4, masked string) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", "", ""
	}
	first4, last4 = CardSearchParts(raw)
	if first4 == "" && last4 == "" {
		return "", "", raw
	}
	if first4 != "" && last4 != "" {
		masked = first4 + "********" + last4
	} else {
		masked = raw
	}
	return first4, last4, masked
}

// CardSearchParts extracts searchable first/last digit groups from a card query or PAN.
// Masked examples: "458300XXXXXXXXX7" -> ("4583", "7"); "9231****6542" -> ("9231", "6542").
// Digit-only: "92316542" -> ("9231", "6542"); "6542" -> ("", "6542").
func CardSearchParts(raw string) (first4, last4 string) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", ""
	}
	if strings.ContainsAny(raw, "Xx*") {
		leading, trailing := maskedDigitRuns(raw)
		if len(leading) >= 4 {
			first4 = leading[:4]
		} else {
			first4 = leading
		}
		if len(trailing) >= 4 {
			last4 = trailing[len(trailing)-4:]
		} else {
			last4 = trailing
		}
		return first4, last4
	}

	d := digitsOnlyRunes(raw)
	switch {
	case len(d) >= 8:
		return d[:4], d[len(d)-4:]
	case len(d) == 4:
		// Bare 4 digits: treat as last 4 (common ATM lookup).
		return "", d
	case len(d) > 4:
		// e.g. 4583007 with X stripped already: BIN prefix + remainder as last suffix.
		return d[:4], d[4:]
	case len(d) > 0:
		return "", d
	default:
		return "", ""
	}
}

func maskedDigitRuns(raw string) (leading, trailing string) {
	runes := []rune(raw)
	i := 0
	for i < len(runes) && (runes[i] < '0' || runes[i] > '9') {
		i++
	}
	start := i
	for i < len(runes) && runes[i] >= '0' && runes[i] <= '9' {
		i++
	}
	leading = string(runes[start:i])

	j := len(runes) - 1
	for j >= 0 && (runes[j] < '0' || runes[j] > '9') {
		j--
	}
	end := j
	for j >= 0 && runes[j] >= '0' && runes[j] <= '9' {
		j--
	}
	if end >= 0 {
		trailing = string(runes[j+1 : end+1])
	}
	// All-digit string with no mask should not use this path; if it did, avoid
	// double-counting the same run as both leading and trailing.
	if leading != "" && leading == trailing && !strings.ContainsAny(raw, "Xx*") {
		return leading, ""
	}
	return leading, trailing
}

func digitsOnlyRunes(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
