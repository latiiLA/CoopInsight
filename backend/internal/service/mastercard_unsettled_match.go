package service

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

// Mastercard unsettled matching assumptions:
//
//  1. Settlement usually posts on or shortly after clearing. For a clearing day D,
//     look at IPM settlement summaries (function 680/685/688) on D, D+1, D+2
//     (prefer same day, then next days).
//  2. Match on absolute amount + transaction currency. Prefer PDS 0381 (credits),
//     then 0380 (debits), then 0384 (net) in the transaction currency (DE49).
//     Prefer function 685 (Financial position) over 680 (currency summary) over
//     688; use 680 only when no 685 amount matches. Reconciliation-currency
//     totals (039x) are not used for primary matching because Oracle clearing
//     amounts are in the transaction currency.
//  3. Institution IDs (DE93/DE100) are recorded for diagnostics only. Oracle
//     TR_TXNSRC/TR_TXNDEST are switch routing bins, not Mastercard IIDs, so
//     they must not reject an amount+currency+day match.
//  4. Pass 1: each settlement amount slot is consumed once by one clearing row
//     with the same absolute amount (1:1 exact match within tolerance).
//  5. Pass 2: among still-unmatched clearing on day D, find a subset whose
//     amounts sum exactly to an unused settlement total on D..D+2, then mark
//     every member of that subset. Never mark a single clearing row matched
//     to a larger settlement total it does not equal.
const (
	mcSettlementMatchWindowDays = 2
	mcAmountMatchTolerance      = 0.01

	mcMatchStatusMatched   = "matched"
	mcMatchStatusUnmatched = "unmatched"
)

// settlementAmountCandidate is one usable amount from a 680/685/688 summary.
type settlementAmountCandidate struct {
	Date         time.Time
	Currency     string
	AmountAbs    float64
	Field        string // PDS tag, e.g. "0381"
	FunctionCode string
	FileID       string
	Institution  string
	BusinessKey  string
	Used         bool
}

func annotateMastercardUnsettled(
	clearing []model.UnsettledTransaction,
	summaries []model.MastercardIPMTransaction,
) []model.UnsettledTransaction {
	if len(clearing) == 0 {
		return clearing
	}

	candidates := buildSettlementAmountCandidates(summaries)
	finPos := buildFinancialPositionIndex(summaries)
	out := make([]model.UnsettledTransaction, len(clearing))
	copy(out, clearing)

	// Pass 1: individual amount + currency + nearest settlement day (1:1).
	for i := range out {
		matchIndividualSettlement(&out[i], candidates, finPos)
	}

	// Pass 2: exact subset sum of unmatched clearing to an unused settlement total.
	matchClearingSumsToSettlement(out, candidates, finPos)

	for i := range out {
		if out[i].MatchStatus == "" {
			out[i].MatchStatus = mcMatchStatusUnmatched
			if out[i].MatchNote == "" {
				out[i].MatchNote = "no nearby IPM settlement amount match"
			}
		}
	}
	return out
}

// financialPositionEntry holds the preferred amount from a function-685
// Financial position summary (credits, then debits, then net).
type financialPositionEntry struct {
	Amount float64
	Field  string
	Date   time.Time
	FileID string
}

// buildFinancialPositionIndex indexes 685 rows by fileID|currency|day and by
// day|currency so matched 680/688 rows can surface the related cycle total.
func buildFinancialPositionIndex(summaries []model.MastercardIPMTransaction) map[string]financialPositionEntry {
	out := make(map[string]financialPositionEntry)
	put := func(key string, e financialPositionEntry) {
		if key == "" || e.Amount < mcAmountMatchTolerance {
			return
		}
		prev, ok := out[key]
		if !ok || e.Amount > prev.Amount {
			out[key] = e
		}
	}
	for _, s := range summaries {
		if s.FunctionCode != "685" {
			continue
		}
		date := s.TransactionDate
		if date.IsZero() {
			date = dateFromIPMFileID(s.FileID)
		}
		if date.IsZero() {
			continue
		}
		date = time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
		currency := strings.TrimSpace(s.CurrencyCode)
		if currency == "" {
			continue
		}
		exponent := pdsCurrencyExponent(s.PDS, currency)
		chosenTag := ""
		var chosenAbs float64
		for _, tag := range []string{"0381", "0380", "0384"} {
			raw := ""
			if s.PDS != nil {
				raw = s.PDS[tag]
			}
			_, abs, ok := parseIPMSettlementAmount(raw, exponent)
			if !ok || abs < mcAmountMatchTolerance {
				continue
			}
			chosenTag = tag
			chosenAbs = abs
			break
		}
		if chosenTag == "" {
			continue
		}
		e := financialPositionEntry{
			Amount: chosenAbs,
			Field:  chosenTag,
			Date:   date,
			FileID: s.FileID,
		}
		day := date.Format("2006-01-02")
		if s.FileID != "" {
			put(s.FileID+"|"+currency+"|"+day, e)
		}
		put(day+"|"+currency, e)
	}
	return out
}

func lookupFinancialPosition(finPos map[string]financialPositionEntry, c *settlementAmountCandidate) (financialPositionEntry, bool) {
	if finPos == nil || c == nil {
		return financialPositionEntry{}, false
	}
	day := c.Date.Format("2006-01-02")
	if c.FileID != "" {
		if e, ok := finPos[c.FileID+"|"+c.Currency+"|"+day]; ok {
			return e, true
		}
	}
	if e, ok := finPos[day+"|"+c.Currency]; ok {
		return e, true
	}
	// When the match itself is against a 685 row, use that candidate amount.
	if c.FunctionCode == "685" {
		return financialPositionEntry{
			Amount: c.AmountAbs,
			Field:  c.Field,
			Date:   c.Date,
			FileID: c.FileID,
		}, true
	}
	return financialPositionEntry{}, false
}

func buildSettlementAmountCandidates(summaries []model.MastercardIPMTransaction) []*settlementAmountCandidate {
	out := make([]*settlementAmountCandidate, 0, len(summaries)*3)
	for _, s := range summaries {
		if s.MessageType != model.IPMMessageSettlementSummary &&
			s.FunctionCode != "680" && s.FunctionCode != "685" && s.FunctionCode != "688" {
			continue
		}
		date := s.TransactionDate
		if date.IsZero() {
			date = dateFromIPMFileID(s.FileID)
		}
		if date.IsZero() {
			continue
		}
		date = time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
		currency := strings.TrimSpace(s.CurrencyCode)
		if currency == "" {
			continue
		}
		exponent := pdsCurrencyExponent(s.PDS, currency)
		institution := firstNonEmpty(s.DestinationInstitutionID, s.OriginatorInstitutionID)

		// One consumable amount slot per summary: prefer credits (0381), then
		// debits (0380), then net (0384). Using all three would double-count
		// when net equals credits (common on single-sided files).
		chosenTag := ""
		var chosenAbs float64
		for _, tag := range []string{"0381", "0380", "0384"} {
			raw := ""
			if s.PDS != nil {
				raw = s.PDS[tag]
			}
			_, abs, ok := parseIPMSettlementAmount(raw, exponent)
			if !ok || abs < mcAmountMatchTolerance {
				continue
			}
			chosenTag = tag
			chosenAbs = abs
			break
		}
		if chosenTag == "" {
			continue
		}
		out = append(out, &settlementAmountCandidate{
			Date:         date,
			Currency:     currency,
			AmountAbs:    chosenAbs,
			Field:        chosenTag,
			FunctionCode: s.FunctionCode,
			FileID:       s.FileID,
			Institution:  institution,
			BusinessKey:  s.BusinessKey + "|" + chosenTag,
		})
	}
	return dedupeSettlementCandidates(out)
}

// dedupeSettlementCandidates keeps one slot per date+currency+amount, preferring
// function 685 over 680/688 so financial-position amounts win over currency
// summary when both carry the same credits and would otherwise double-consume.
func dedupeSettlementCandidates(in []*settlementAmountCandidate) []*settlementAmountCandidate {
	type key struct {
		day      string
		currency string
		amount   int64 // minor units to avoid float key issues
	}
	best := map[key]*settlementAmountCandidate{}
	for _, c := range in {
		if c == nil {
			continue
		}
		k := key{
			day:      c.Date.Format("2006-01-02"),
			currency: c.Currency,
			amount:   int64(math.Round(c.AmountAbs * 100)),
		}
		prev, ok := best[k]
		if !ok || settlementFunctionRank(c.FunctionCode) < settlementFunctionRank(prev.FunctionCode) {
			best[k] = c
		}
	}
	out := make([]*settlementAmountCandidate, 0, len(best))
	for _, c := range best {
		out = append(out, c)
	}
	return out
}

func matchIndividualSettlement(txn *model.UnsettledTransaction, candidates []*settlementAmountCandidate, finPos map[string]financialPositionEntry) {
	clearingDate := parseOracleDate(firstNonEmpty(txn.TxnDate, txn.Date))
	if clearingDate.IsZero() {
		txn.MatchStatus = mcMatchStatusUnmatched
		txn.MatchNote = "clearing date unavailable"
		return
	}
	clearingDate = time.Date(clearingDate.Year(), clearingDate.Month(), clearingDate.Day(), 0, 0, 0, 0, time.UTC)
	currency := strconv.FormatInt(txn.Currency, 10)
	amount := math.Abs(txn.Amount)

	bestIdx := -1
	bestOffset := mcSettlementMatchWindowDays + 1
	bestFieldRank := 99
	bestFuncRank := 99

	for i, c := range candidates {
		if c == nil || c.Used {
			continue
		}
		if !currenciesEquivalent(c.Currency, currency) {
			continue
		}
		if math.Abs(c.AmountAbs-amount) > mcAmountMatchTolerance {
			continue
		}
		offsetDays := int(c.Date.Sub(clearingDate).Hours() / 24)
		if offsetDays < 0 || offsetDays > mcSettlementMatchWindowDays {
			continue
		}
		if !institutionSoftMatch(txn, c.Institution) {
			continue
		}
		fieldRank := settlementFieldRank(c.Field)
		funcRank := settlementFunctionRank(c.FunctionCode)
		if offsetDays < bestOffset ||
			(offsetDays == bestOffset && fieldRank < bestFieldRank) ||
			(offsetDays == bestOffset && fieldRank == bestFieldRank && funcRank < bestFuncRank) {
			bestIdx = i
			bestOffset = offsetDays
			bestFieldRank = fieldRank
			bestFuncRank = funcRank
		}
	}

	if bestIdx < 0 {
		return
	}
	applySettlementMatch(txn, candidates[bestIdx], "amount", finPos)
}

func matchClearingSumsToSettlement(txns []model.UnsettledTransaction, candidates []*settlementAmountCandidate, finPos map[string]financialPositionEntry) {
	type groupKey struct {
		day      string
		currency string
	}
	groups := map[groupKey][]int{}
	for i := range txns {
		if txns[i].MatchStatus == mcMatchStatusMatched {
			continue
		}
		d := parseOracleDate(firstNonEmpty(txns[i].TxnDate, txns[i].Date))
		if d.IsZero() {
			continue
		}
		key := groupKey{
			day:      d.Format("2006-01-02"),
			currency: strconv.FormatInt(txns[i].Currency, 10),
		}
		groups[key] = append(groups[key], i)
	}

	for key, idxs := range groups {
		if len(idxs) < 2 {
			continue
		}
		clearingDay, err := time.Parse("2006-01-02", key.day)
		if err != nil {
			continue
		}

		type rankedCand struct {
			idx        int
			offsetDays int
			fieldRank  int
			funcRank   int
		}
		ranked := make([]rankedCand, 0, len(candidates))
		for i, c := range candidates {
			if c == nil || c.Used {
				continue
			}
			if !currenciesEquivalent(c.Currency, key.currency) {
				continue
			}
			offsetDays := int(c.Date.Sub(clearingDay).Hours() / 24)
			if offsetDays < 0 || offsetDays > mcSettlementMatchWindowDays {
				continue
			}
			okInst := false
			for _, ti := range idxs {
				if institutionSoftMatch(&txns[ti], c.Institution) {
					okInst = true
					break
				}
			}
			if !okInst {
				continue
			}
			ranked = append(ranked, rankedCand{
				idx:        i,
				offsetDays: offsetDays,
				fieldRank:  settlementFieldRank(c.Field),
				funcRank:   settlementFunctionRank(c.FunctionCode),
			})
		}
		// Nearest day, then preferred PDS field, then preferred function code.
		for i := 0; i < len(ranked); i++ {
			for j := i + 1; j < len(ranked); j++ {
				a, b := ranked[i], ranked[j]
				swap := b.offsetDays < a.offsetDays ||
					(b.offsetDays == a.offsetDays && b.fieldRank < a.fieldRank) ||
					(b.offsetDays == a.offsetDays && b.fieldRank == a.fieldRank && b.funcRank < a.funcRank)
				if swap {
					ranked[i], ranked[j] = ranked[j], ranked[i]
				}
			}
		}

		remaining := append([]int(nil), idxs...)
		for _, rc := range ranked {
			c := candidates[rc.idx]
			if c == nil || c.Used {
				continue
			}
			if len(remaining) < 2 {
				break
			}
			subset := findExactAmountSubset(txns, remaining, c.AmountAbs)
			if len(subset) < 2 {
				continue
			}
			for _, ti := range subset {
				applySettlementMatch(&txns[ti], c, "sum", finPos)
			}
			// Drop matched members from remaining for further candidates.
			matched := map[int]struct{}{}
			for _, ti := range subset {
				matched[ti] = struct{}{}
			}
			next := remaining[:0]
			for _, ti := range remaining {
				if _, ok := matched[ti]; !ok {
					next = append(next, ti)
				}
			}
			remaining = next
		}
	}
}

// findExactAmountSubset returns txn indices (from idxs) of a subset with size >= 2
// whose absolute amounts sum exactly to target (within cent rounding). Prefers the
// smallest such subset; among equal sizes, the one found first via 0-1 DP.
func findExactAmountSubset(txns []model.UnsettledTransaction, idxs []int, target float64) []int {
	n := len(idxs)
	if n < 2 {
		return nil
	}
	targetCents := int64(math.Round(target * 100))
	if targetCents <= 0 {
		return nil
	}

	cents := make([]int64, n)
	for i, ti := range idxs {
		cents[i] = int64(math.Round(math.Abs(txns[ti].Amount) * 100))
		if cents[i] <= 0 {
			cents[i] = 0
		}
	}

	type reach struct {
		prev  int64
		item  int // index into cents/idxs; -1 = origin
		count int
	}
	// best[sum] = how we reached sum with the fewest items
	best := map[int64]reach{0: {prev: -1, item: -1, count: 0}}

	for i := 0; i < n; i++ {
		if cents[i] <= 0 {
			continue
		}
		type upd struct {
			sum int64
			r   reach
		}
		updates := make([]upd, 0)
		for sum, r := range best {
			newSum := sum + cents[i]
			if newSum > targetCents {
				continue
			}
			newCount := r.count + 1
			prev, exists := best[newSum]
			if exists && prev.count <= newCount {
				continue
			}
			updates = append(updates, upd{
				sum: newSum,
				r:   reach{prev: sum, item: i, count: newCount},
			})
		}
		for _, u := range updates {
			prev, exists := best[u.sum]
			if !exists || u.r.count < prev.count {
				best[u.sum] = u.r
			}
		}
	}

	r, ok := best[targetCents]
	if !ok || r.count < 2 {
		return nil
	}

	pickedLocal := make([]int, 0, r.count)
	for r.item >= 0 {
		pickedLocal = append(pickedLocal, r.item)
		prevSum := r.prev
		r = best[prevSum]
	}
	out := make([]int, len(pickedLocal))
	for i, local := range pickedLocal {
		out[i] = idxs[local]
	}
	return out
}

func applySettlementMatch(txn *model.UnsettledTransaction, c *settlementAmountCandidate, mode string, finPos map[string]financialPositionEntry) {
	c.Used = true
	txn.MatchStatus = mcMatchStatusMatched
	txn.MatchedSettlementDate = c.Date.Format("2006-01-02")
	// Settlement amount that matched: txn-level for 1:1, subset total for sum.
	txn.MatchedAmount = c.AmountAbs
	txn.MatchedAmountField = c.Field
	txn.MatchedFunctionCode = c.FunctionCode
	txn.MatchedFileID = c.FileID
	txn.MatchMode = mode
	txn.MatchedClearingAmount = math.Abs(txn.Amount)
	if fp, ok := lookupFinancialPosition(finPos, c); ok {
		txn.FinancialPositionTotal = fp.Amount
		txn.FinancialPositionField = fp.Field
	}
	if mode == "sum" {
		txn.MatchNote = fmt.Sprintf(
			"sum-of-clearing matched IPM %s PDS %s (txn %.2f of settl. %.2f)",
			c.FunctionCode, c.Field, math.Abs(txn.Amount), c.AmountAbs,
		)
	} else {
		txn.MatchNote = fmt.Sprintf("amount matched IPM %s PDS %s", c.FunctionCode, c.Field)
	}
}

func settlementFieldRank(tag string) int {
	switch tag {
	case "0381":
		return 0
	case "0380":
		return 1
	case "0384":
		return 2
	default:
		return 9
	}
}

func settlementFunctionRank(code string) int {
	switch code {
	case "685":
		return 0 // financial position — prefer over currency summary
	case "680":
		return 1 // currency summary — fallback when no 685 match
	case "688":
		return 2
	default:
		return 9
	}
}

func institutionSoftMatch(txn *model.UnsettledTransaction, settlementInst string) bool {
	// Oracle TR_TXNSRC / TR_TXNDEST are switch routing bins (e.g. 487016,
	// 9555555555), not Mastercard institution IDs (DE93/DE100, e.g. 034457).
	// Never reject on institution: amount + currency + nearest-day already
	// constrain the match. Kept as a hook for future preference ranking.
	_ = txn
	_ = settlementInst
	return true
}

// currenciesEquivalent treats ISO numeric and common alpha codes as equal
// (Oracle TR_CURRENCY_SOURCE is numeric; IPM DE49 is numeric; UI may say ETB).
func currenciesEquivalent(a, b string) bool {
	a = strings.ToUpper(strings.TrimSpace(a))
	b = strings.ToUpper(strings.TrimSpace(b))
	if a == "" || b == "" {
		return false
	}
	if a == b {
		return true
	}
	norm := func(c string) string {
		switch c {
		case "ETB", "230":
			return "230"
		case "USD", "840":
			return "840"
		case "EUR", "978":
			return "978"
		default:
			return stripLeadingZeros(c)
		}
	}
	return norm(a) == norm(b)
}

func stripLeadingZeros(s string) string {
	t := strings.TrimLeft(s, "0")
	if t == "" {
		return "0"
	}
	return t
}

func isAllDigits(s string) bool {
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

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

// parseIPMSettlementAmount parses PDS amount values such as "C0000000002200000"
// or "D0000000000000000" into major-unit floats using the currency exponent.
func parseIPMSettlementAmount(raw string, exponent int) (signed float64, abs float64, ok bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, 0, false
	}
	if exponent < 0 || exponent > 6 {
		exponent = 2
	}

	sign := 1.0
	digits := raw
	if m := len(raw); m > 0 {
		switch raw[0] {
		case 'C', 'c':
			digits = raw[1:]
			sign = 1
		case 'D', 'd':
			digits = raw[1:]
			sign = -1
		}
	}
	// Some recon tags prefix a fee code before D/C (e.g. "00D000000000000258").
	if idx := strings.IndexAny(digits, "DCdc"); idx >= 0 {
		switch digits[idx] {
		case 'D', 'd':
			sign = -1
		default:
			sign = 1
		}
		digits = digits[idx+1:]
	}
	digits = strings.TrimLeft(digits, "0")
	if digits == "" {
		digits = "0"
	}
	if !isAllDigits(digits) {
		return 0, 0, false
	}
	minor, err := strconv.ParseInt(digits, 10, 64)
	if err != nil {
		return 0, 0, false
	}
	div := math.Pow10(exponent)
	abs = float64(minor) / div
	if sign < 0 && abs != 0 {
		signed = -abs
	} else {
		signed = abs
	}
	return signed, abs, true
}

// pdsCurrencyExponent reads PDS 0148 repeating n-4 groups (currency + exponent).
func pdsCurrencyExponent(pds map[string]string, currency string) int {
	if pds == nil || currency == "" {
		return 2
	}
	raw := pds["0148"]
	for i := 0; i+4 <= len(raw); i += 4 {
		chunk := raw[i : i+4]
		if chunk[:3] == currency {
			exp := int(chunk[3] - '0')
			if exp >= 0 && exp <= 6 {
				return exp
			}
		}
	}
	return 2
}
