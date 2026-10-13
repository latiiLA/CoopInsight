package oracle

import (
	"encoding/binary"
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

// Fixed offsets observed in oasis.IST_SAFDB.RAW_MSG (IST advice buffer).
// Matches the fields printed by `istadvicecmd list`.
//
// Trace (DE11 / STAN) is a little-endian uint32 at offset 556 — not the
// ASCII slot at 1078, which is AUTHNUM (DE38) and is often empty or
// alphanumeric on Cortex advices.
const (
	safRawMTIOffset   = 0
	safRawPANOffset   = 8
	safRawPANLen      = 20
	safRawPCodeOffset = 28
	safRawAmountAt    = 44
	safRawTraceOffset = 556
)

type safDecodedMsg struct {
	MsgType   int
	Trace     string
	PCode     string
	Amount    string
	MaskedPan string
}

func decodeSafRawMsg(raw []byte) safDecodedMsg {
	var out safDecodedMsg
	if len(raw) < 2 {
		return out
	}
	out.MsgType = int(binary.LittleEndian.Uint16(raw[safRawMTIOffset : safRawMTIOffset+2]))

	if len(raw) >= safRawPANOffset+safRawPANLen {
		out.MaskedPan = maskPan(cstrField(raw[safRawPANOffset : safRawPANOffset+safRawPANLen]))
	}
	if len(raw) >= safRawPCodeOffset+4 {
		out.PCode = fmt.Sprintf("%06d", binary.LittleEndian.Uint32(raw[safRawPCodeOffset:safRawPCodeOffset+4]))
	}
	if len(raw) > safRawAmountAt {
		out.Amount = formatSafAmount(cstrField(raw[safRawAmountAt:minInt(len(raw), safRawAmountAt+32)]))
	}
	if len(raw) >= safRawTraceOffset+4 {
		stan := binary.LittleEndian.Uint32(raw[safRawTraceOffset : safRawTraceOffset+4])
		if stan > 0 {
			out.Trace = fmt.Sprintf("%06d", stan)
		}
	}

	return out
}

func cstrField(b []byte) string {
	n := len(b)
	for i, c := range b {
		if c == 0 {
			n = i
			break
		}
	}
	return strings.TrimSpace(string(b[:n]))
}

func maskPan(pan string) string {
	digits := make([]byte, 0, len(pan))
	for i := 0; i < len(pan); i++ {
		if pan[i] >= '0' && pan[i] <= '9' {
			digits = append(digits, pan[i])
		}
	}
	if len(digits) < 12 || len(digits) > 19 {
		return ""
	}
	return string(digits[:6]) + strings.Repeat("*", len(digits)-10) + string(digits[len(digits)-4:])
}

func formatSafAmount(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	sign := ""
	switch raw[0] {
	case '+', '-':
		sign = string(raw[0])
		raw = raw[1:]
	}
	if raw == "" || !isAllDigits(raw) {
		return ""
	}
	n, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return ""
	}
	// IST advice list shows major units with two decimals (4000 → 4000.00).
	if sign == "-" {
		n = -n
	}
	return fmt.Sprintf("%d.00", n)
}

func isAllDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if !unicode.IsDigit(r) {
			return false
		}
	}
	return true
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
