package sshswitch

import (
	"encoding/hex"
	"regexp"
	"strconv"
	"strings"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

var (
	headerRe = regexp.MustCompile(`(?m)^(\d{2}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2})\s+\[\s*(FromCTX|ToCTX):[^\]]*\]\*+\s+(INBOUND|OUTBOUND) MESSAGE ID\[([^\]]+)\]`)
	fieldRe  = regexp.MustCompile(`(?m)^\s*(in|out)\[\s*(\d+|amount):\s*\]<(.*)>$`)
	msgnoRe  = regexp.MustCompile(`msgno\[\s*\d+\]<(\d+)>`)
)

var droppedFields = map[string]struct{}{
	"2":   {},
	"35":  {},
	"102": {},
	"124": {},
	"257": {},
}

var processingTypes = map[string]string{
	"00": "Purchase",
	"01": "Cash withdrawal",
	"10": "Account funding",
	"12": "Cash deposit",
	"20": "Refund",
	"21": "Deposit",
	"30": "Available funds",
	"31": "Balance inquiry",
	"35": "Mini statement",
	"40": "Transfer",
	"50": "Payment",
	"70": "PIN change",
}

func ParseDump(raw string) []model.OnusEvent {
	events := parseDumpInOrder(raw)
	for i, j := 0, len(events)-1; i < j; i, j = i+1, j-1 {
		events[i], events[j] = events[j], events[i]
	}

	return events
}

func parseDumpInOrder(raw string) []model.OnusEvent {
	indexes := headerRe.FindAllStringSubmatchIndex(raw, -1)
	if len(indexes) == 0 {
		return nil
	}

	events := make([]model.OnusEvent, 0, len(indexes))

	for i, loc := range indexes {
		matches := headerRe.FindStringSubmatch(raw[loc[0]:loc[1]])
		if len(matches) < 5 {
			continue
		}

		end := len(raw)
		if i+1 < len(indexes) {
			end = indexes[i+1][0]
		}

		body := raw[loc[1]:end]
		event, ok := parseBlock(matches[1], matches[3], matches[4], body)
		if ok {
			events = append(events, event)
		}
	}

	return events
}

type StreamParser struct {
	buf strings.Builder
}

func (p *StreamParser) AddLine(line string) []model.OnusEvent {
	p.buf.WriteString(line)
	p.buf.WriteByte('\n')

	raw := p.buf.String()
	indexes := headerRe.FindAllStringSubmatchIndex(raw, -1)
	if len(indexes) < 2 {
		return nil
	}

	lastStart := indexes[len(indexes)-1][0]
	events := parseDumpInOrder(raw[:lastStart])
	p.buf.Reset()
	p.buf.WriteString(raw[lastStart:])

	return events
}

func parseBlock(timestamp, direction, messageID, body string) (model.OnusEvent, bool) {
	fields := map[string]string{}
	amountRaw := ""

	for _, match := range fieldRe.FindAllStringSubmatch(body, -1) {
		if len(match) < 4 {
			continue
		}

		key := strings.TrimSpace(match[2])
		value := strings.TrimSpace(match[3])
		if value == "" || strings.HasPrefix(value, "<") {
			continue
		}

		if key == "amount" {
			if amountRaw == "" {
				amountRaw = value
			}
			continue
		}

		if _, drop := droppedFields[key]; drop {
			continue
		}

		fields[key] = value
	}

	mti := ""
	if match := msgnoRe.FindStringSubmatch(body); len(match) == 2 {
		mti = padMTI(match[1])
	}
	if mti == "" {
		mti = padMTI(fields["105"])
	}

	responseCode := fields["39"]
	if responseCode == "" || (mti != "" && mti != "0210") {
		return model.OnusEvent{}, false
	}

	mcc := fields["18"]
	if mcc != "" && mcc != "6011" {
		return model.OnusEvent{}, false
	}

	processingCode := padProcessingCode(fields["3"])
	amount := parseAmount(amountRaw)
	if amount == 0 {
		if decoded, ok := asciiFromHexDigits(fields["4"]); ok {
			amount = parseAmount(decoded)
		} else {
			amount = parseAmount(fields["4"])
		}
	}

	event := model.OnusEvent{
		ID:             messageID,
		Time:           timestamp,
		Direction:      strings.ToLower(direction),
		MTI:            mti,
		ResponseCode:   responseCode,
		Approved:       isApproved(responseCode),
		Terminal:       strings.TrimSpace(fields["41"]),
		ProcessingCode: processingCode,
		Type:           processingType(processingCode),
		Amount:         amount,
		MCC:            mcc,
		STAN:           strings.TrimSpace(fields["11"]),
		RRN:            decodeMaybeHex(fields["37"]),
		AuthCode:       strings.TrimSpace(fields["38"]),
		Acquirer:       strings.TrimSpace(fields["32"]),
	}

	return event, true
}

func isApproved(code string) bool {
	switch strings.TrimSpace(code) {
	case "00", "000", "0":
		return true
	default:
		return false
	}
}

func padMTI(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}

	for len(value) < 4 {
		value = "0" + value
	}

	if len(value) > 4 {
		return value[len(value)-4:]
	}

	return value
}

func padProcessingCode(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}

	for len(value) < 6 {
		value = "0" + value
	}

	if len(value) > 6 {
		return value[:6]
	}

	return value
}

func processingType(code string) string {
	if len(code) < 2 {
		return code
	}

	if label, ok := processingTypes[code[:2]]; ok {
		return label
	}

	return code
}

func parseAmount(raw string) float64 {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0
	}

	n, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0
	}

	return float64(n) / 100
}

func asciiFromHexDigits(value string) (string, bool) {
	value = strings.TrimSpace(value)
	if len(value) < 2 || len(value)%2 != 0 {
		return "", false
	}

	decoded, err := hex.DecodeString(value)
	if err != nil {
		return "", false
	}

	for _, b := range decoded {
		if b < '0' || b > '9' {
			return "", false
		}
	}

	return string(decoded), true
}

func decodeMaybeHex(value string) string {
	value = strings.TrimSpace(value)
	if decoded, ok := asciiFromHexDigits(value); ok {
		return decoded
	}

	return value
}
