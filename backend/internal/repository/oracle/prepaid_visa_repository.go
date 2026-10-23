package oracle

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"golang.org/x/sync/errgroup"
)

const (
	prepaidVisaDefaultPageSize = 500
	prepaidVisaMaxPageSize     = 2000
	// Activity sheet lists — small pages so shared-wallet detail stays responsive.
	prepaidVisaActivityDefaultPageSize = 40
	prepaidVisaActivityMaxPageSize     = 100

	// Stable Cortex product IDs for prepaid international Visa (see discovery notes).
	// Prefer CRDPRODUCT_ID over TRIM(CRDPRODUCT) so Oracle can use the FK index.
	prepaidVisaProductID401 int64 = 85
	prepaidVisaProductID402 int64 = 86
)

func normalizePrepaidVisaActivityPage(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = prepaidVisaActivityDefaultPageSize
	}
	if pageSize > prepaidVisaActivityMaxPageSize {
		pageSize = prepaidVisaActivityMaxPageSize
	}
	return page, pageSize
}

func normalizePrepaidVisaPage(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = prepaidVisaDefaultPageSize
	}
	if pageSize > prepaidVisaMaxPageSize {
		pageSize = prepaidVisaMaxPageSize
	}
	return page, pageSize
}

func trimPrepaidVisaPage[T any](rows []T, pageSize int) ([]T, bool) {
	_, pageSize = normalizePrepaidVisaPage(1, pageSize)
	if len(rows) > pageSize {
		return rows[:pageSize], true
	}
	return rows, false
}

type prepaidVisaRepository struct {
	db *sql.DB
}

func NewPrepaidVisaRepository(db *sql.DB) repository.PrepaidVisaRepository {
	return &prepaidVisaRepository{db: db}
}

func prepaidVisaProductIDList(product string) string {
	switch strings.TrimSpace(product) {
	case "401":
		return "85"
	case "402":
		return "86"
	default:
		return "85, 86"
	}
}

// prepaidVisaTlogProductPred filters denormalized tlog.CRDPRODUCT.
// Prefer LIKE '401%' over TRIM(...) so the predicate stays sargable; values are
// confirmed populated for prepaid cards. Pair with CTXDATE (indexed) â€” DATELOCAL
// has no leading index on cortex.tlog.
func prepaidVisaTlogProductPred(product string) string {
	switch strings.TrimSpace(product) {
	case "401":
		return " AND t.CRDPRODUCT LIKE '401%'"
	case "402":
		return " AND t.CRDPRODUCT LIKE '402%'"
	default:
		return " AND (t.CRDPRODUCT LIKE '401%' OR t.CRDPRODUCT LIKE '402%')"
	}
}

// Reversal MTIs undo the original financial effect. On cortex.tlog the class is
// MSGCLS (not MSGTYPE — that lives on oasis.shclog / clearing). Prepaid stores
// class 4 for 4xx reversals (410/420/430); full MTIs are kept for safety.
// Cortex keeps the same AMTBILL / AMTTXN sign as the original, so spend totals
// and row amounts must flip for these classes.
const (
	prepaidVisaSignedAmtBill = `CASE WHEN t.MSGCLS IN (4, 410, 420, 430) THEN -NVL(t.AMTBILL, 0) ELSE NVL(t.AMTBILL, 0) END`
	prepaidVisaSignedAmtTxn  = `CASE WHEN t.MSGCLS IN (4, 410, 420, 430) THEN -NVL(t.AMTTXN, 0) ELSE NVL(t.AMTTXN, 0) END`
)

// prepaidVisaWalletCardIDs returns every prepaid card sharing the opened card's
// account. Falls back to the single card when it has no account link.
func (r *prepaidVisaRepository) prepaidVisaWalletCardIDs(ctx context.Context, cardID int64) ([]int64, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT DISTINCT sib.CRDDET_ID
		FROM cortex.crdacc opened
		JOIN cortex.crdacc sib ON sib.ACCDET_ID = opened.ACCDET_ID
		JOIN cortex.crddet c
			ON c.ID = sib.CRDDET_ID
			AND c.CRDPRODUCT_ID IN (85, 86)
		WHERE opened.CRDDET_ID = :card_id
			AND opened.ACCDET_ID IS NOT NULL
		ORDER BY sib.CRDDET_ID
	`, sql.Named("card_id", cardID))
	if err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	ids := make([]int64, 0, 4)
	for rows.Next() {
		var id sql.NullInt64
		if err := rows.Scan(&id); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}
		if id.Valid && id.Int64 > 0 {
			ids = append(ids, id.Int64)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	if len(ids) == 0 {
		return []int64{cardID}, nil
	}
	return ids, nil
}

func prepaidVisaCardIDInList(ids []int64) string {
	if len(ids) == 0 {
		return "0"
	}
	parts := make([]string, 0, len(ids))
	for _, id := range ids {
		if id < 1 {
			continue
		}
		parts = append(parts, strconv.FormatInt(id, 10))
	}
	if len(parts) == 0 {
		return "0"
	}
	return strings.Join(parts, ", ")
}

func prepaidVisaProductMeta(id int64) (code, name string) {
	switch id {
	case prepaidVisaProductID401:
		return "401", "Visa Platinum Int."
	case prepaidVisaProductID402:
		return "402", "Visa Classic Int."
	default:
		return fmt.Sprintf("%d", id), "Prepaid Visa"
	}
}

// prepaidVisaProductFilter kept for tests / list SQL that still join crdproduct.
func prepaidVisaProductFilter(alias, product string) string {
	switch strings.TrimSpace(product) {
	case "401", "402":
		return fmt.Sprintf(" AND TRIM(%s.CRDPRODUCT) = '%s'", alias, strings.TrimSpace(product))
	default:
		return ""
	}
}

const prepaidVisaCardholderNull = `CAST(NULL AS VARCHAR2(1)) AS CARDHOLDER_NAME,`

// Prepaid cards store given name in FIRSTNAME and the remainder in LASTNAME
// (e.g. "SEMIRA" + "SIRAJ AHMED"). Debit card activity deliberately omits
// LASTNAME because those columns often duplicate the full name; prepaid does
// not, so we join them when they differ.
const prepaidVisaCardholderPermitted = `TRIM(
		NVL(NULLIF(TRIM(c.L10N_FIRSTNAME), ''), NULLIF(TRIM(c.FIRSTNAME), ''))
		|| CASE
			WHEN NULLIF(TRIM(c.LASTNAME), '') IS NULL THEN ''
			WHEN UPPER(TRIM(c.LASTNAME)) = UPPER(TRIM(
				NVL(NULLIF(TRIM(c.L10N_FIRSTNAME), ''), NULLIF(TRIM(c.FIRSTNAME), ''))
			)) THEN ''
			ELSE ' ' || TRIM(c.LASTNAME)
		END
	) AS CARDHOLDER_NAME,`

const prepaidVisaCardSelect = `
	c.ID AS CARD_ID,
	SUBSTR(c.PAN_DISPLAY, 1, 6) || 'XXXXXX' || SUBSTR(c.PAN_DISPLAY, -4) AS CARD_MASKED,
	%s
	CASE c.CRDPRODUCT_ID
		WHEN 85 THEN '401'
		WHEN 86 THEN '402'
		ELSE TO_CHAR(c.CRDPRODUCT_ID)
	END AS PRODUCT_CODE,
	NVL(TRIM(p.DESCR), 'Prepaid Visa') AS PRODUCT_NAME,
	TRIM(c.STATCODE) AS STATUS_CODE,
	TRIM(s.DESCR) AS STATUS_DESCRIPTION,
	TRIM(b.BRNCODE) AS BRANCH_CODE,
	TRIM(b.DESCR) AS BRANCH_NAME,
	NVL(a.AVLBAL, 0) AS AVAILABLE_BALANCE,
	NVL(a.AVLBAL, 0) + NVL(a.SHDWAUTHOV, 0) - NVL(a.BLKAMT, 0) + NVL(a.UNCLRCREDIT, 0) AS AVAILABLE_AMOUNT,
	NVL(a.BLKAMT, 0) AS BLOCKED_BALANCE,
	NVL(-amt.SUM_AMTAVL, 0) AS FROM_AVAILABLE,
	NVL(-amt.SUM_UNLOAD_AMTAVL, 0) AS UNLOADED,
	TRIM(TO_CHAR(a.CURRCODE)) AS ACCOUNT_CURRENCY
`

// prepaidVisaReconcileTolerance is the abs variance allowed for
// Top-up ≈ Available Amount + Blocked + From Available + Unloaded.
const prepaidVisaReconcileTolerance = 1.0

// Account unload (wrong-load correction): TXNCODE 210 with empty DESCRIPTION.
// Not merchant spend; not a top-up (LOADTYPE/LOADSRC 50).
// Use prepaidVisaUnloadPredI when the accitems alias is i.
const (
	prepaidVisaUnloadPred  = `NVL(LOADTYPE, 0) = 0 AND NVL(LOADSRC, 0) = 0 AND NVL(TXNCODE, 0) = 210 AND TRIM(NVL(DESCRIPTION, ' ')) IS NULL`
	prepaidVisaUnloadPredI = `NVL(i.LOADTYPE, 0) = 0 AND NVL(i.LOADSRC, 0) = 0 AND NVL(i.TXNCODE, 0) = 210 AND TRIM(NVL(i.DESCRIPTION, ' ')) IS NULL`
)

func prepaidVisaIsUnload(loadType, loadSrc, txnCode int64, desc string) bool {
	return loadType == 0 && loadSrc == 0 && txnCode == 210 && strings.TrimSpace(desc) == ""
}

// prepaidVisaSanitizeSearch strips LIKE wildcards and caps length for bind safety.
func prepaidVisaSanitizeSearch(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch r {
		case '%', '_', ';', '\'', '"':
			continue
		default:
			b.WriteRune(r)
		}
	}
	out := b.String()
	if len(out) > 64 {
		out = out[:64]
	}
	return out
}

// Date bound for CTXDATE columns. Empty dates → soft 24-month cap (RRN/card lookups).
func prepaidVisaLedgerDateClause(alias, dateFrom, dateTo string) (string, []any) {
	if strings.TrimSpace(dateFrom) == "" || strings.TrimSpace(dateTo) == "" {
		return fmt.Sprintf(` AND %s.CTXDATE >= ADD_MONTHS(TRUNC(SYSDATE), -24)`, alias), nil
	}
	return fmt.Sprintf(`
			AND %s.CTXDATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
			AND %s.CTXDATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1`, alias, alias),
		[]any{sql.Named("date_from", dateFrom), sql.Named("date_to", dateTo)}
}

func prepaidVisaCardholderNameExpr() string {
	return `UPPER(TRIM(NVL(c.FIRSTNAME, '') || ' ' || NVL(c.LASTNAME, '')))`
}

// Shared card / branch / free-text filters for dedicated search.
func prepaidVisaSearchCommonClause(req model.PrepaidVisaSearchRequest, includeCardholder bool, qCols string) (string, []any) {
	var parts []string
	var args []any

	card := prepaidVisaSanitizeSearch(req.Card)
	if card != "" {
		cardUp := strings.ToUpper(card)
		parts = append(parts, `(
			UPPER(TRIM(NVL(c.PAN_DISPLAY, ' '))) LIKE :card_like
			OR SUBSTR(TRIM(c.PAN_DISPLAY), -4) = :card_exact
		)`)
		args = append(args,
			sql.Named("card_like", "%"+cardUp+"%"),
			sql.Named("card_exact", cardUp),
		)
	}

	branch := strings.ToUpper(prepaidVisaSanitizeSearch(req.Branch))
	if branch != "" {
		parts = append(parts, `(
			UPPER(TRIM(NVL(b.BRNCODE, ' '))) LIKE :branch_like
			OR UPPER(TRIM(NVL(b.DESCR, ' '))) LIKE :branch_like
		)`)
		args = append(args, sql.Named("branch_like", "%"+branch+"%"))
	}

	holder := strings.ToUpper(prepaidVisaSanitizeSearch(req.Cardholder))
	if holder != "" && includeCardholder {
		parts = append(parts, `(
			`+prepaidVisaCardholderNameExpr()+` LIKE :holder_like
			OR UPPER(TRIM(NVL(c.EMBOSSNAME, ' '))) LIKE :holder_like
		)`)
		args = append(args, sql.Named("holder_like", "%"+holder+"%"))
	}

	q := strings.ToUpper(prepaidVisaSanitizeSearch(req.Q))
	if q != "" && qCols != "" {
		parts = append(parts, "("+qCols+")")
		args = append(args,
			sql.Named("q_like", "%"+q+"%"),
			sql.Named("q_exact", q),
		)
	}

	if len(parts) == 0 {
		return "", nil
	}
	return " AND " + strings.Join(parts, " AND "), args
}

func prepaidVisaLedgerSearchQCols(includeCardholder bool) string {
	cols := `
			UPPER(TRIM(NVL(i.DESCRIPTION, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(a.ACCNO, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(c.PAN_DISPLAY, ' '))) LIKE :q_like
			OR SUBSTR(TRIM(c.PAN_DISPLAY), -4) = :q_exact
			OR UPPER(TRIM(NVL(b.DESCR, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(b.BRNCODE, ' '))) LIKE :q_like`
	if includeCardholder {
		cols += `
			OR ` + prepaidVisaCardholderNameExpr() + ` LIKE :q_like
			OR UPPER(TRIM(NVL(c.EMBOSSNAME, ' '))) LIKE :q_like`
	}
	return cols
}

func prepaidVisaTxnSearchQCols(includeCardholder bool) string {
	cols := `
			UPPER(TRIM(NVL(t.RRN, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(t.CRDACPTLOC, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(t.CRDACPTID, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(t.TERMCODE, ' '))) LIKE :q_like
			OR UPPER(TRIM(NVL(c.PAN_DISPLAY, ' '))) LIKE :q_like
			OR SUBSTR(TRIM(c.PAN_DISPLAY), -4) = :q_exact
			OR UPPER(TRIM(NVL(b.DESCR, ' '))) LIKE :q_like
			OR TO_CHAR(NVL(t.AMTBILL, 0)) LIKE :q_like`
	if includeCardholder {
		cols += `
			OR ` + prepaidVisaCardholderNameExpr() + ` LIKE :q_like
			OR UPPER(TRIM(NVL(c.EMBOSSNAME, ' '))) LIKE :q_like`
	}
	return cols
}

func prepaidVisaLedgerExtraSearchClause(req model.PrepaidVisaSearchRequest) (string, []any) {
	var parts []string
	var args []any

	acct := strings.ToUpper(prepaidVisaSanitizeSearch(req.Account))
	if acct != "" {
		parts = append(parts, `UPPER(TRIM(NVL(a.ACCNO, ' '))) LIKE :acct_like`)
		args = append(args, sql.Named("acct_like", "%"+acct+"%"))
	}
	desc := strings.ToUpper(prepaidVisaSanitizeSearch(req.Description))
	if desc != "" {
		parts = append(parts, `UPPER(TRIM(NVL(i.DESCRIPTION, ' '))) LIKE :desc_like`)
		args = append(args, sql.Named("desc_like", "%"+desc+"%"))
	}
	if req.AmountMin != nil {
		parts = append(parts, `NVL(i.AMTBILL, 0) >= :amt_min`)
		args = append(args, sql.Named("amt_min", *req.AmountMin))
	}
	if req.AmountMax != nil {
		parts = append(parts, `NVL(i.AMTBILL, 0) <= :amt_max`)
		args = append(args, sql.Named("amt_max", *req.AmountMax))
	}
	if len(parts) == 0 {
		return "", nil
	}
	return " AND " + strings.Join(parts, " AND "), args
}

func prepaidVisaTxnExtraSearchClause(req model.PrepaidVisaSearchRequest) (string, []any) {
	var parts []string
	var args []any

	rrn := strings.ToUpper(prepaidVisaSanitizeSearch(req.RRN))
	if rrn != "" {
		parts = append(parts, `UPPER(TRIM(NVL(t.RRN, ' '))) LIKE :rrn_like`)
		args = append(args, sql.Named("rrn_like", rrn+"%"))
	}
	merchant := strings.ToUpper(prepaidVisaSanitizeSearch(req.Merchant))
	if merchant != "" {
		parts = append(parts, `(
			UPPER(TRIM(NVL(t.CRDACPTLOC, ' '))) LIKE :merch_like
			OR UPPER(TRIM(NVL(t.CRDACPTID, ' '))) LIKE :merch_like
		)`)
		args = append(args, sql.Named("merch_like", "%"+merchant+"%"))
	}
	term := strings.ToUpper(prepaidVisaSanitizeSearch(req.Terminal))
	if term != "" {
		parts = append(parts, `UPPER(TRIM(NVL(t.TERMCODE, ' '))) LIKE :term_like`)
		args = append(args, sql.Named("term_like", "%"+term+"%"))
	}
	switch strings.ToLower(strings.TrimSpace(req.Result)) {
	case "approved":
		parts = append(parts, `TRIM(t.RSPCODE) = '00'`)
	case "declined":
		parts = append(parts, `TRIM(NVL(t.RSPCODE, ' ')) <> '00'`)
	}
	switch strings.ToLower(strings.TrimSpace(req.Reversal)) {
	case "exclude":
		parts = append(parts, `t.MSGCLS NOT IN (4, 410, 420, 430)`)
	case "only":
		parts = append(parts, `t.MSGCLS IN (4, 410, 420, 430)`)
	}
	if req.AmountMin != nil {
		parts = append(parts, `NVL(t.AMTBILL, 0) >= :amt_min`)
		args = append(args, sql.Named("amt_min", *req.AmountMin))
	}
	if req.AmountMax != nil {
		parts = append(parts, `NVL(t.AMTBILL, 0) <= :amt_max`)
		args = append(args, sql.Named("amt_max", *req.AmountMax))
	}
	if len(parts) == 0 {
		return "", nil
	}
	return " AND " + strings.Join(parts, " AND "), args
}

// Join fragment: per-card from-available vs unload (= −AMTAVL) and Σ AMTBLK.
// Unloads are carved out of from-available so corrections are not treated as spend.
// Include REV=1 rows: reversing postings (opposite AMTAVL) that undo a prior take.
const prepaidVisaAmtJoin = `
		LEFT JOIN (
			SELECT
				CRDDET_ID,
				NVL(SUM(CASE
					WHEN NVL(LOADTYPE, 0) = 0 AND NVL(LOADSRC, 0) = 0
						AND NVL(TXNCODE, 0) = 210 AND TRIM(NVL(DESCRIPTION, ' ')) IS NULL
					THEN 0 ELSE AMTAVL
				END), 0) AS SUM_AMTAVL,
				NVL(SUM(CASE
					WHEN NVL(LOADTYPE, 0) = 0 AND NVL(LOADSRC, 0) = 0
						AND NVL(TXNCODE, 0) = 210 AND TRIM(NVL(DESCRIPTION, ' ')) IS NULL
					THEN AMTAVL ELSE 0
				END), 0) AS SUM_UNLOAD_AMTAVL,
				NVL(SUM(AMTBLK), 0) AS SUM_AMTBLK
			FROM cortex.accitems
			GROUP BY CRDDET_ID
		) amt ON amt.CRDDET_ID = c.ID
`

func (r *prepaidVisaRepository) GetDashboard(
	ctx context.Context,
	dateFrom, dateTo, product string,
) (*model.PrepaidVisaDashboard, error) {
	out := &model.PrepaidVisaDashboard{
		DateFrom:      dateFrom,
		DateTo:        dateTo,
		FleetCurrency: "840",
		ByProduct:     []model.PrepaidVisaProductBreakdown{},
		Daily:         []model.PrepaidVisaDailyPoint{},
		TopMerchants:  []model.PrepaidVisaMerchantSpend{},
	}

	ids := prepaidVisaProductIDList(product)
	var (
		mu       sync.Mutex
		byProd   = map[string]*model.PrepaidVisaProductBreakdown{}
		dailyMap = map[string]*model.PrepaidVisaDailyPoint{}
	)

	ensureProduct := func(id int64) *model.PrepaidVisaProductBreakdown {
		code, name := prepaidVisaProductMeta(id)
		if item, ok := byProd[code]; ok {
			return item
		}
		item := &model.PrepaidVisaProductBreakdown{
			ProductCode: code,
			ProductName: name,
		}
		byProd[code] = item
		return item
	}

	g, gctx := errgroup.WithContext(ctx)

	// 1) Current fleet + available/blocked by product (snapshot, not date-ranged).
	// Balances are summed once per wallet account. Some prepaid cards share an
	// account — summing per card would double-count available/blocked.
	g.Go(func() error {
		q := `
			WITH prepaid AS (
				SELECT
					c.ID AS card_id,
					c.CRDPRODUCT_ID,
					ca.ACCDET_ID
				FROM cortex.crddet c
				LEFT JOIN cortex.crdacc ca ON ca.CRDDET_ID = c.ID
				WHERE c.CRDPRODUCT_ID IN (` + ids + `)
			),
			card_stats AS (
				SELECT
					p.CRDPRODUCT_ID,
					COUNT(DISTINCT p.card_id) AS fleet_cards,
					COUNT(DISTINCT CASE
						WHEN NVL(a.BLKAMT, 0) <> 0 THEN p.card_id
					END) AS blocked_cards
				FROM prepaid p
				LEFT JOIN cortex.accdet a ON a.ID = p.ACCDET_ID
				GROUP BY p.CRDPRODUCT_ID
			),
			acct_stats AS (
				SELECT
					x.CRDPRODUCT_ID,
					NVL(SUM(a.AVLBAL), 0) AS available_bal,
					NVL(SUM(a.AVLBAL), 0) + NVL(SUM(a.SHDWAUTHOV), 0)
						- NVL(SUM(a.BLKAMT), 0) + NVL(SUM(a.UNCLRCREDIT), 0) AS available_amt,
					NVL(SUM(a.BLKAMT), 0) AS blocked_bal,
					NVL(MAX(TRIM(TO_CHAR(a.CURRCODE))), '840') AS curr
				FROM (
					SELECT
						ACCDET_ID,
						MIN(CRDPRODUCT_ID) AS CRDPRODUCT_ID
					FROM prepaid
					WHERE ACCDET_ID IS NOT NULL
					GROUP BY ACCDET_ID
				) x
				JOIN cortex.accdet a ON a.ID = x.ACCDET_ID
				GROUP BY x.CRDPRODUCT_ID
			)
			SELECT
				c.CRDPRODUCT_ID,
				c.fleet_cards,
				NVL(a.available_bal, 0) AS available_bal,
				NVL(a.available_amt, 0) AS available_amt,
				NVL(a.blocked_bal, 0) AS blocked_bal,
				c.blocked_cards,
				NVL(a.curr, '840') AS curr
			FROM card_stats c
			LEFT JOIN acct_stats a ON a.CRDPRODUCT_ID = c.CRDPRODUCT_ID
		`
		rows, err := r.db.QueryContext(gctx, q)
		if err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		defer func() { _ = rows.Close() }()

		var fleetCards, blockedCards int
		var fleetAvail, fleetAvailAmt, fleetBlocked float64
		var curr string
		for rows.Next() {
			var id, cards, blocked sql.NullInt64
			var avail, availAmt, blockedBal sql.NullFloat64
			var currency sql.NullString
			if err := rows.Scan(
				&id, &cards, &avail, &availAmt, &blockedBal, &blocked, &currency,
			); err != nil {
				return wrapError(common.ErrFailedToFetchReport, err)
			}
			mu.Lock()
			item := ensureProduct(id.Int64)
			item.FleetCards = int(cards.Int64)
			item.AvailableBal = avail.Float64
			item.AvailableAmount = availAmt.Float64
			item.BlockedBal = blockedBal.Float64
			item.BlockedCards = int(blocked.Int64)
			fleetCards += int(cards.Int64)
			blockedCards += int(blocked.Int64)
			fleetAvail += avail.Float64
			fleetAvailAmt += availAmt.Float64
			fleetBlocked += blockedBal.Float64
			if currency.Valid && currency.String != "" {
				curr = currency.String
			}
			mu.Unlock()
		}
		if err := rows.Err(); err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		mu.Lock()
		out.FleetCards = fleetCards
		out.FleetAvailableBal = fleetAvail
		out.FleetAvailableAmount = fleetAvailAmt
		out.FleetBlockedBal = fleetBlocked
		out.BlockedCards = blockedCards
		if curr != "" {
			out.FleetCurrency = curr
		}
		mu.Unlock()
		return nil
	})

	// 1b) From available (−Σ non-unload AMTAVL), unloaded (−Σ unload AMTAVL), Σ AMTBLK.
	// Include REV=1 reversing postings so cancelled spend nets out.
	g.Go(func() error {
		q := `
			SELECT
				c.CRDPRODUCT_ID,
				NVL(SUM(CASE
					WHEN NVL(i.LOADTYPE, 0) = 0 AND NVL(i.LOADSRC, 0) = 0
						AND NVL(i.TXNCODE, 0) = 210 AND TRIM(NVL(i.DESCRIPTION, ' ')) IS NULL
					THEN 0 ELSE -i.AMTAVL
				END), 0) AS from_available,
				NVL(SUM(CASE
					WHEN NVL(i.LOADTYPE, 0) = 0 AND NVL(i.LOADSRC, 0) = 0
						AND NVL(i.TXNCODE, 0) = 210 AND TRIM(NVL(i.DESCRIPTION, ' ')) IS NULL
					THEN -i.AMTAVL ELSE 0
				END), 0) AS unloaded,
				NVL(SUM(i.AMTBLK), 0) AS amt_blocked
			FROM cortex.accitems i
			JOIN cortex.crddet c
				ON c.ID = i.CRDDET_ID
				AND c.CRDPRODUCT_ID IN (` + ids + `)
			GROUP BY c.CRDPRODUCT_ID
		`
		rows, err := r.db.QueryContext(gctx, q)
		if err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		defer func() { _ = rows.Close() }()

		var fleetFromAvailable, fleetUnloaded, amtBlocked float64
		for rows.Next() {
			var id sql.NullInt64
			var fromAvailable, unloaded, blocked sql.NullFloat64
			if err := rows.Scan(&id, &fromAvailable, &unloaded, &blocked); err != nil {
				return wrapError(common.ErrFailedToFetchReport, err)
			}
			mu.Lock()
			item := ensureProduct(id.Int64)
			item.FromAvailable = fromAvailable.Float64
			item.Unloaded = unloaded.Float64
			fleetFromAvailable += fromAvailable.Float64
			fleetUnloaded += unloaded.Float64
			amtBlocked += blocked.Float64
			mu.Unlock()
		}
		if err := rows.Err(); err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		mu.Lock()
		out.FleetFromAvailable = fleetFromAvailable
		out.FleetUnloaded = fleetUnloaded
		out.AmtBlockedSum = amtBlocked
		mu.Unlock()
		return nil
	})

	// 1c) Lifetime top-ups (portfolio snapshot, not date-ranged).
	g.Go(func() error {
		q := `
			SELECT
				COUNT(*) AS topup_count,
				NVL(SUM(i.AMTBILL), 0) AS topup_amount
			FROM cortex.accitems i
			JOIN cortex.crddet c
				ON c.ID = i.CRDDET_ID
				AND c.CRDPRODUCT_ID IN (` + ids + `)
			WHERE i.LOADTYPE = 50
				AND i.LOADSRC = 50
				AND NVL(i.REV, 0) = 0
		`
		var count sql.NullInt64
		var amount sql.NullFloat64
		if err := r.db.QueryRowContext(gctx, q).Scan(&count, &amount); err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		mu.Lock()
		out.FleetTopUpCount = int(count.Int64)
		out.FleetTopUpAmount = amount.Float64
		mu.Unlock()
		return nil
	})

	// 1c2) Lifetime unload count (portfolio snapshot).
	g.Go(func() error {
		q := `
			SELECT
				COUNT(*) AS unload_count
			FROM cortex.accitems i
			JOIN cortex.crddet c
				ON c.ID = i.CRDDET_ID
				AND c.CRDPRODUCT_ID IN (` + ids + `)
			WHERE ` + prepaidVisaUnloadPredI + `
				AND NVL(i.REV, 0) = 0
		`
		var count sql.NullInt64
		if err := r.db.QueryRowContext(gctx, q).Scan(&count); err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		mu.Lock()
		out.FleetUnloadCount = int(count.Int64)
		mu.Unlock()
		return nil
	})

	// 1d) Lifetime approved spend (signed; MSGCLS 4 / 4xx reversals net out).
	g.Go(func() error {
		q := `
			SELECT
				NVL(SUM(CASE WHEN t.RSPCODE = '00' THEN ` + prepaidVisaSignedAmtBill + ` ELSE 0 END), 0) AS approved_amount
			FROM cortex.tlog t
			WHERE 1=1` + prepaidVisaTlogProductPred(product)
		var amount sql.NullFloat64
		if err := r.db.QueryRowContext(gctx, q).Scan(&amount); err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		mu.Lock()
		out.FleetApprovedAmount = amount.Float64
		mu.Unlock()
		return nil
	})

	// 2) Top-up period totals (billing currency AMTBILL).
	g.Go(func() error {
		q := `
			SELECT
				COUNT(*) AS topup_count,
				NVL(SUM(i.AMTBILL), 0) AS topup_amount,
				COUNT(DISTINCT i.CRDDET_ID) AS topup_cards,
				NVL(MAX(i.AMTBILL), 0) AS largest
			FROM cortex.accitems i
			JOIN cortex.crddet c
				ON c.ID = i.CRDDET_ID
				AND c.CRDPRODUCT_ID IN (` + ids + `)
			WHERE i.LOADTYPE = 50
				AND i.LOADSRC = 50
				AND NVL(i.REV, 0) = 0
				AND i.CTXDATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
				AND i.CTXDATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1
		`
		var count, cards sql.NullInt64
		var amount, largest sql.NullFloat64
		if err := r.db.QueryRowContext(
			gctx, q,
			sql.Named("date_from", dateFrom),
			sql.Named("date_to", dateTo),
		).Scan(&count, &amount, &cards, &largest); err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		mu.Lock()
		out.TopUpCount = int(count.Int64)
		out.TopUpAmount = amount.Float64
		out.TopUpCards = int(cards.Int64)
		out.LargestTopUp = largest.Float64
		mu.Unlock()
		return nil
	})

	// 2b) Unload period totals.
	g.Go(func() error {
		q := `
			SELECT
				COUNT(*) AS unload_count,
				NVL(SUM(i.AMTBILL), 0) AS unload_amount,
				COUNT(DISTINCT i.CRDDET_ID) AS unload_cards
			FROM cortex.accitems i
			JOIN cortex.crddet c
				ON c.ID = i.CRDDET_ID
				AND c.CRDPRODUCT_ID IN (` + ids + `)
			WHERE ` + prepaidVisaUnloadPredI + `
				AND NVL(i.REV, 0) = 0
				AND i.CTXDATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
				AND i.CTXDATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1
		`
		var count, cards sql.NullInt64
		var amount sql.NullFloat64
		if err := r.db.QueryRowContext(
			gctx, q,
			sql.Named("date_from", dateFrom),
			sql.Named("date_to", dateTo),
		).Scan(&count, &amount, &cards); err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		mu.Lock()
		out.UnloadCount = int(count.Int64)
		out.UnloadAmount = amount.Float64
		out.UnloadCards = int(cards.Int64)
		mu.Unlock()
		return nil
	})

	// 3) Spend period totals — billing currency (AMTBILL), not mixed FX AMTTXN.
	// Reversals (410/420/430) subtract from the net.
	g.Go(func() error {
		q := `
			SELECT
				COUNT(*) AS txn_count,
				NVL(SUM(` + prepaidVisaSignedAmtBill + `), 0) AS txn_amount,
				NVL(SUM(CASE WHEN t.RSPCODE = '00' THEN ` + prepaidVisaSignedAmtBill + ` ELSE 0 END), 0) AS approved_amount,
				COUNT(DISTINCT t.CRDDET_ID) AS active_cards,
				SUM(CASE WHEN t.RSPCODE = '00' THEN 1 ELSE 0 END) AS approved,
				SUM(CASE WHEN t.RSPCODE = '00' THEN 0 ELSE 1 END) AS declined
			FROM cortex.tlog t
			WHERE t.CTXDATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
				AND t.CTXDATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1` +
			prepaidVisaTlogProductPred(product)
		var count, active, approved, declined sql.NullInt64
		var amount, approvedAmt sql.NullFloat64
		if err := r.db.QueryRowContext(
			gctx, q,
			sql.Named("date_from", dateFrom),
			sql.Named("date_to", dateTo),
		).Scan(&count, &amount, &approvedAmt, &active, &approved, &declined); err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		mu.Lock()
		out.TxnCount = int(count.Int64)
		out.TxnAmount = amount.Float64
		out.ApprovedAmount = approvedAmt.Float64
		out.ActiveCards = int(active.Int64)
		out.ApprovedCount = int(approved.Int64)
		out.DeclinedCount = int(declined.Int64)
		mu.Unlock()
		return nil
	})

	// 4) Top-ups by product (period).
	g.Go(func() error {
		q := `
			SELECT
				c.CRDPRODUCT_ID,
				COUNT(*) AS topup_count,
				NVL(SUM(i.AMTBILL), 0) AS topup_amount
			FROM cortex.accitems i
			JOIN cortex.crddet c
				ON c.ID = i.CRDDET_ID
				AND c.CRDPRODUCT_ID IN (` + ids + `)
			WHERE i.LOADTYPE = 50
				AND i.LOADSRC = 50
				AND NVL(i.REV, 0) = 0
				AND i.CTXDATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
				AND i.CTXDATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1
			GROUP BY c.CRDPRODUCT_ID
		`
		rows, err := r.db.QueryContext(
			gctx, q,
			sql.Named("date_from", dateFrom),
			sql.Named("date_to", dateTo),
		)
		if err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		defer func() { _ = rows.Close() }()
		for rows.Next() {
			var id, count sql.NullInt64
			var amount sql.NullFloat64
			if err := rows.Scan(&id, &count, &amount); err != nil {
				return wrapError(common.ErrFailedToFetchReport, err)
			}
			mu.Lock()
			item := ensureProduct(id.Int64)
			item.TopUpCount = int(count.Int64)
			item.TopUpAmount = amount.Float64
			mu.Unlock()
		}
		return wrapRowsErr(rows)
	})

	// 5) Spend by product (period).
	g.Go(func() error {
		q := `
			SELECT
				SUBSTR(t.CRDPRODUCT, 1, 3) AS product_code,
				COUNT(*) AS txn_count,
				NVL(SUM(` + prepaidVisaSignedAmtBill + `), 0) AS txn_amount,
				NVL(SUM(CASE WHEN t.RSPCODE = '00' THEN ` + prepaidVisaSignedAmtBill + ` ELSE 0 END), 0) AS approved_amount,
				COUNT(DISTINCT t.CRDDET_ID) AS active_cards
			FROM cortex.tlog t
			WHERE t.CTXDATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
				AND t.CTXDATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1` +
			prepaidVisaTlogProductPred(product) + `
			GROUP BY SUBSTR(t.CRDPRODUCT, 1, 3)
		`
		rows, err := r.db.QueryContext(
			gctx, q,
			sql.Named("date_from", dateFrom),
			sql.Named("date_to", dateTo),
		)
		if err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		defer func() { _ = rows.Close() }()
		for rows.Next() {
			var code sql.NullString
			var count, active sql.NullInt64
			var amount, approvedAmt sql.NullFloat64
			if err := rows.Scan(&code, &count, &amount, &approvedAmt, &active); err != nil {
				return wrapError(common.ErrFailedToFetchReport, err)
			}
			var id int64
			switch strings.TrimSpace(code.String) {
			case "401":
				id = prepaidVisaProductID401
			case "402":
				id = prepaidVisaProductID402
			default:
				continue
			}
			mu.Lock()
			item := ensureProduct(id)
			item.TxnCount = int(count.Int64)
			item.TxnAmount = amount.Float64
			item.ApprovedAmount = approvedAmt.Float64
			item.ActiveCards = int(active.Int64)
			mu.Unlock()
		}
		return wrapRowsErr(rows)
	})

	// 6) Daily top-ups â€” plain GROUP BY, no correlated subqueries.
	g.Go(func() error {
		q := `
			SELECT
				TO_CHAR(TRUNC(i.CTXDATE), 'YYYY-MM-DD') AS day,
				COUNT(*) AS topup_count,
				NVL(SUM(i.AMTBILL), 0) AS topup_amount
			FROM cortex.accitems i
			JOIN cortex.crddet c
				ON c.ID = i.CRDDET_ID
				AND c.CRDPRODUCT_ID IN (` + ids + `)
			WHERE i.LOADTYPE = 50
				AND i.LOADSRC = 50
				AND NVL(i.REV, 0) = 0
				AND i.CTXDATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
				AND i.CTXDATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1
			GROUP BY TRUNC(i.CTXDATE)
		`
		rows, err := r.db.QueryContext(
			gctx, q,
			sql.Named("date_from", dateFrom),
			sql.Named("date_to", dateTo),
		)
		if err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		defer func() { _ = rows.Close() }()
		for rows.Next() {
			var day sql.NullString
			var count sql.NullInt64
			var amount sql.NullFloat64
			if err := rows.Scan(&day, &count, &amount); err != nil {
				return wrapError(common.ErrFailedToFetchReport, err)
			}
			mu.Lock()
			pt := dailyMap[day.String]
			if pt == nil {
				pt = &model.PrepaidVisaDailyPoint{Date: day.String}
				dailyMap[day.String] = pt
			}
			pt.TopUpCount = int(count.Int64)
			pt.TopUpAmount = amount.Float64
			mu.Unlock()
		}
		return wrapRowsErr(rows)
	})

	// 7) Daily spend — plain GROUP BY on indexed CTXDATE.
	g.Go(func() error {
		q := `
			SELECT
				TO_CHAR(TRUNC(t.CTXDATE), 'YYYY-MM-DD') AS day,
				COUNT(*) AS txn_count,
				NVL(SUM(` + prepaidVisaSignedAmtBill + `), 0) AS txn_amount,
				NVL(SUM(CASE WHEN t.RSPCODE = '00' THEN ` + prepaidVisaSignedAmtBill + ` ELSE 0 END), 0) AS approved_amount,
				COUNT(DISTINCT t.CRDDET_ID) AS active_cards
			FROM cortex.tlog t
			WHERE t.CTXDATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
				AND t.CTXDATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1` +
			prepaidVisaTlogProductPred(product) + `
			GROUP BY TRUNC(t.CTXDATE)
		`
		rows, err := r.db.QueryContext(
			gctx, q,
			sql.Named("date_from", dateFrom),
			sql.Named("date_to", dateTo),
		)
		if err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		defer func() { _ = rows.Close() }()
		for rows.Next() {
			var day sql.NullString
			var count, active sql.NullInt64
			var amount, approvedAmt sql.NullFloat64
			if err := rows.Scan(&day, &count, &amount, &approvedAmt, &active); err != nil {
				return wrapError(common.ErrFailedToFetchReport, err)
			}
			mu.Lock()
			pt := dailyMap[day.String]
			if pt == nil {
				pt = &model.PrepaidVisaDailyPoint{Date: day.String}
				dailyMap[day.String] = pt
			}
			pt.TxnCount = int(count.Int64)
			pt.TxnAmount = amount.Float64
			pt.ApprovedAmount = approvedAmt.Float64
			pt.ActiveCards = int(active.Int64)
			mu.Unlock()
		}
		return wrapRowsErr(rows)
	})

	// 8) Top merchants.
	g.Go(func() error {
		q := `
			SELECT
				NVL(NULLIF(TRIM(t.CRDACPTLOC), ''), 'Unknown') AS merchant,
				COUNT(*) AS txn_count,
				NVL(SUM(` + prepaidVisaSignedAmtBill + `), 0) AS txn_amount,
				NVL(SUM(CASE WHEN t.RSPCODE = '00' THEN ` + prepaidVisaSignedAmtBill + ` ELSE 0 END), 0) AS approved_amt
			FROM cortex.tlog t
			WHERE t.CTXDATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
				AND t.CTXDATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1` +
			prepaidVisaTlogProductPred(product) + `
			GROUP BY NVL(NULLIF(TRIM(t.CRDACPTLOC), ''), 'Unknown')
			ORDER BY approved_amt DESC, txn_count DESC
			FETCH FIRST 10 ROWS ONLY
		`
		rows, err := r.db.QueryContext(
			gctx, q,
			sql.Named("date_from", dateFrom),
			sql.Named("date_to", dateTo),
		)
		if err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		defer func() { _ = rows.Close() }()

		merchants := make([]model.PrepaidVisaMerchantSpend, 0, 10)
		for rows.Next() {
			var merchant sql.NullString
			var count sql.NullInt64
			var amount, apprvd sql.NullFloat64
			if err := rows.Scan(&merchant, &count, &amount, &apprvd); err != nil {
				return wrapError(common.ErrFailedToFetchReport, err)
			}
			merchants = append(merchants, model.PrepaidVisaMerchantSpend{
				Merchant:    merchant.String,
				TxnCount:    int(count.Int64),
				TxnAmount:   amount.Float64,
				ApprovedAmt: apprvd.Float64,
			})
		}
		if err := rows.Err(); err != nil {
			return wrapError(common.ErrFailedToFetchReport, err)
		}
		mu.Lock()
		out.TopMerchants = merchants
		mu.Unlock()
		return nil
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

	codes := make([]string, 0, len(byProd))
	for code := range byProd {
		codes = append(codes, code)
	}
	sort.Strings(codes)
	out.ByProduct = make([]model.PrepaidVisaProductBreakdown, 0, len(codes))
	for _, code := range codes {
		out.ByProduct = append(out.ByProduct, *byProd[code])
	}

	days := make([]string, 0, len(dailyMap))
	for day := range dailyMap {
		days = append(days, day)
	}
	sort.Strings(days)
	out.Daily = make([]model.PrepaidVisaDailyPoint, 0, len(days))
	for _, day := range days {
		out.Daily = append(out.Daily, *dailyMap[day])
	}

	if out.TopUpCount > 0 {
		out.AvgTopUp = out.TopUpAmount / float64(out.TopUpCount)
	}
	if out.TxnCount > 0 {
		out.AvgTxn = out.TxnAmount / float64(out.TxnCount)
		out.ApprovalRate = float64(out.ApprovedCount) / float64(out.TxnCount) * 100
	}
	// Blocked (open holds) + from-available.
	out.BlockedPlusFromAvailable = out.FleetBlockedBal + out.FleetFromAvailable
	// Top-up check target: Available Amount + Blocked + From Available + Unloaded.
	out.ReconcileExpected = out.FleetAvailableAmount + out.FleetBlockedBal + out.FleetFromAvailable + out.FleetUnloaded

	return out, nil
}

func (r *prepaidVisaRepository) ListCardReconciliation(
	ctx context.Context,
	product string,
	includeCardholder bool,
) (*model.PrepaidVisaReconcileReport, error) {
	ids := prepaidVisaProductIDList(product)
	cardholder := prepaidVisaCardholderNull
	if includeCardholder {
		cardholder = prepaidVisaCardholderPermitted
	}

	// One row per wallet account. Shared-account cards roll top-ups,
	// from-available, and unloads together so balances are not double-counted.
	q := fmt.Sprintf(`
		WITH prepaid AS (
			SELECT
				c.ID AS card_id,
				ca.ACCDET_ID
			FROM cortex.crddet c
			JOIN cortex.crdacc ca ON ca.CRDDET_ID = c.ID
			WHERE c.CRDPRODUCT_ID IN (%s)
				AND ca.ACCDET_ID IS NOT NULL
		),
		rolled AS (
			SELECT
				p.ACCDET_ID,
				MIN(p.card_id) AS primary_card_id,
				COUNT(*) AS linked_cards,
				NVL(SUM(tops.TOPUP_AMOUNT), 0) AS TOPUP_AMOUNT,
				NVL(SUM(-amt.SUM_AMTAVL), 0) AS FROM_AVAILABLE,
				NVL(SUM(-amt.SUM_UNLOAD_AMTAVL), 0) AS UNLOADED
			FROM prepaid p
			LEFT JOIN (
				SELECT
					CRDDET_ID,
					NVL(SUM(CASE
						WHEN NVL(LOADTYPE, 0) = 0 AND NVL(LOADSRC, 0) = 0
							AND NVL(TXNCODE, 0) = 210 AND TRIM(NVL(DESCRIPTION, ' ')) IS NULL
						THEN 0 ELSE AMTAVL
					END), 0) AS SUM_AMTAVL,
					NVL(SUM(CASE
						WHEN NVL(LOADTYPE, 0) = 0 AND NVL(LOADSRC, 0) = 0
							AND NVL(TXNCODE, 0) = 210 AND TRIM(NVL(DESCRIPTION, ' ')) IS NULL
						THEN AMTAVL ELSE 0
					END), 0) AS SUM_UNLOAD_AMTAVL
				FROM cortex.accitems
				GROUP BY CRDDET_ID
			) amt ON amt.CRDDET_ID = p.card_id
			LEFT JOIN (
				SELECT
					CRDDET_ID,
					NVL(SUM(AMTBILL), 0) AS TOPUP_AMOUNT
				FROM cortex.accitems
				WHERE LOADTYPE = 50
					AND LOADSRC = 50
					AND NVL(REV, 0) = 0
				GROUP BY CRDDET_ID
			) tops ON tops.CRDDET_ID = p.card_id
			GROUP BY p.ACCDET_ID
		)
		SELECT
			c.ID AS CARD_ID,
			SUBSTR(c.PAN_DISPLAY, 1, 6) || 'XXXXXX' || SUBSTR(c.PAN_DISPLAY, -4) AS CARD_MASKED,
			%s
			CASE c.CRDPRODUCT_ID
				WHEN 85 THEN '401'
				WHEN 86 THEN '402'
				ELSE TO_CHAR(c.CRDPRODUCT_ID)
			END AS PRODUCT_CODE,
			NVL(TRIM(p.DESCR), 'Prepaid Visa') AS PRODUCT_NAME,
			TRIM(c.STATCODE) AS STATUS_CODE,
			TRIM(s.DESCR) AS STATUS_DESCRIPTION,
			TRIM(b.BRNCODE) AS BRANCH_CODE,
			TRIM(b.DESCR) AS BRANCH_NAME,
			NVL(a.AVLBAL, 0) AS AVAILABLE_BALANCE,
			NVL(a.SHDWAUTHOV, 0) AS OVERRIDE_AMOUNT,
			NVL(a.BLKAMT, 0) AS BLOCKED_BALANCE,
			NVL(a.UNCLRCREDIT, 0) AS UNCLEAR_CREDIT,
			NVL(a.AVLBAL, 0) + NVL(a.SHDWAUTHOV, 0) - NVL(a.BLKAMT, 0) + NVL(a.UNCLRCREDIT, 0) AS AVAILABLE_AMOUNT,
			NVL(r.FROM_AVAILABLE, 0) AS FROM_AVAILABLE,
			NVL(r.UNLOADED, 0) AS UNLOADED,
			NVL(r.TOPUP_AMOUNT, 0) AS TOPUP_AMOUNT,
			NVL(r.linked_cards, 1) AS LINKED_CARDS
		FROM rolled r
		JOIN cortex.crddet c ON c.ID = r.primary_card_id
		LEFT JOIN cortex.crdproduct p ON p.ID = c.CRDPRODUCT_ID
		LEFT JOIN cortex.crdstatus s ON TRIM(c.STATCODE) = TRIM(s.STATCODE)
		LEFT JOIN cortex.branch b ON b.ID = c.BRANCH_ID
		JOIN cortex.accdet a ON a.ID = r.ACCDET_ID
		ORDER BY ABS(NVL(r.TOPUP_AMOUNT, 0) - (
			NVL(a.AVLBAL, 0) + NVL(a.SHDWAUTHOV, 0) - NVL(a.BLKAMT, 0) + NVL(a.UNCLRCREDIT, 0)
			+ NVL(a.BLKAMT, 0) + NVL(r.FROM_AVAILABLE, 0) + NVL(r.UNLOADED, 0)
		)) DESC, c.ID
	`, ids, cardholder)

	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	out := &model.PrepaidVisaReconcileReport{
		MatchTolerance: prepaidVisaReconcileTolerance,
		Cards:          []model.PrepaidVisaCardReconcile{},
	}

	for rows.Next() {
		var (
			cardID, linkedCards                            sql.NullInt64
			cardMasked, holder, productCode, productName   sql.NullString
			statusCode, statusDesc, branchCode, branchName sql.NullString
			availBal, override, blocked, unclear           sql.NullFloat64
			availAmt, fromAvailable, unloaded, topUp       sql.NullFloat64
		)
		if err := rows.Scan(
			&cardID, &cardMasked, &holder,
			&productCode, &productName,
			&statusCode, &statusDesc,
			&branchCode, &branchName,
			&availBal, &override, &blocked, &unclear,
			&availAmt, &fromAvailable, &unloaded, &topUp,
			&linkedCards,
		); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}

		expected := availAmt.Float64 + blocked.Float64 + fromAvailable.Float64 + unloaded.Float64
		variance := topUp.Float64 - expected
		matched := variance <= prepaidVisaReconcileTolerance && variance >= -prepaidVisaReconcileTolerance

		row := model.PrepaidVisaCardReconcile{
			CardID:            cardID.Int64,
			CardMasked:        cardMasked.String,
			CardholderName:    holder.String,
			ProductCode:       productCode.String,
			ProductName:       productName.String,
			StatusCode:        statusCode.String,
			StatusDescription: statusDesc.String,
			BranchCode:        branchCode.String,
			BranchName:        branchName.String,
			AvailableBalance:  availBal.Float64,
			OverrideAmount:    override.Float64,
			BlockedBalance:    blocked.Float64,
			UnclearCredit:     unclear.Float64,
			AvailableAmount:   availAmt.Float64,
			FromAvailable:     fromAvailable.Float64,
			Unloaded:          unloaded.Float64,
			TopUpAmount:       topUp.Float64,
			LinkedCards:       int(linkedCards.Int64),
			Expected:          expected,
			Variance:          variance,
			Matched:           matched,
		}
		out.Cards = append(out.Cards, row)
		out.CardCount++
		out.TotalTopUp += topUp.Float64
		out.TotalUnloaded += unloaded.Float64
		out.TotalExpected += expected
		out.TotalVariance += variance
		if matched {
			out.MatchedCount++
		} else {
			out.MismatchCount++
		}
		if topUp.Float64 > prepaidVisaReconcileTolerance {
			out.FundedCount++
			if matched {
				out.FundedMatched++
			}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	return out, nil
}

func wrapRowsErr(rows *sql.Rows) error {
	if err := rows.Err(); err != nil {
		return wrapError(common.ErrFailedToFetchReport, err)
	}
	return nil
}

func (r *prepaidVisaRepository) GetCardActivity(
	ctx context.Context,
	cardID int64,
	includeCardholder bool,
	topUpPage, unloadPage, ledgerPage, txnPage, pageSize int,
	sections string,
) (*model.PrepaidVisaCardActivity, error) {
	if cardID < 1 {
		return nil, common.ErrInvalidPrepaidVisaCardID
	}
	cardholder := prepaidVisaCardholderNull
	if includeCardholder {
		cardholder = prepaidVisaCardholderPermitted
	}

	// Wallet-level top-ups / from-available / unloads: include sibling cards.
	cardQ := fmt.Sprintf(`
		SELECT
			c.ID AS CARD_ID,
			SUBSTR(c.PAN_DISPLAY, 1, 6) || 'XXXXXX' || SUBSTR(c.PAN_DISPLAY, -4) AS CARD_MASKED,
			%s
			CASE c.CRDPRODUCT_ID
				WHEN 85 THEN '401'
				WHEN 86 THEN '402'
				ELSE TO_CHAR(c.CRDPRODUCT_ID)
			END AS PRODUCT_CODE,
			NVL(TRIM(p.DESCR), 'Prepaid Visa') AS PRODUCT_NAME,
			TRIM(c.STATCODE) AS STATUS_CODE,
			TRIM(s.DESCR) AS STATUS_DESCRIPTION,
			TRIM(b.BRNCODE) AS BRANCH_CODE,
			TRIM(b.DESCR) AS BRANCH_NAME,
			NVL(a.AVLBAL, 0) AS AVAILABLE_BALANCE,
			NVL(a.SHDWAUTHOV, 0) AS OVERRIDE_AMOUNT,
			NVL(a.BLKAMT, 0) AS BLOCKED_BALANCE,
			NVL(a.UNCLRCREDIT, 0) AS UNCLEAR_CREDIT,
			NVL(a.AVLBAL, 0) + NVL(a.SHDWAUTHOV, 0) - NVL(a.BLKAMT, 0) + NVL(a.UNCLRCREDIT, 0) AS AVAILABLE_AMOUNT,
			NVL(wallet.FROM_AVAILABLE, 0) AS FROM_AVAILABLE,
			NVL(wallet.UNLOADED, 0) AS UNLOADED,
			NVL(wallet.TOPUP_AMOUNT, 0) AS TOPUP_AMOUNT,
			NVL(wallet.LINKED_CARDS, 1) AS LINKED_CARDS
		FROM cortex.crddet c
		LEFT JOIN cortex.crdproduct p ON p.ID = c.CRDPRODUCT_ID
		LEFT JOIN cortex.crdstatus s ON TRIM(c.STATCODE) = TRIM(s.STATCODE)
		LEFT JOIN cortex.branch b ON b.ID = c.BRANCH_ID
		LEFT JOIN cortex.crdacc ca ON ca.CRDDET_ID = c.ID
		LEFT JOIN cortex.accdet a ON a.ID = ca.ACCDET_ID
		LEFT JOIN (
			SELECT
				sib.ACCDET_ID,
				COUNT(*) AS LINKED_CARDS,
				NVL(SUM(-amt.SUM_AMTAVL), 0) AS FROM_AVAILABLE,
				NVL(SUM(-amt.SUM_UNLOAD_AMTAVL), 0) AS UNLOADED,
				NVL(SUM(tops.TOPUP_AMOUNT), 0) AS TOPUP_AMOUNT
			FROM cortex.crdacc sib
			JOIN cortex.crddet sc
				ON sc.ID = sib.CRDDET_ID
				AND sc.CRDPRODUCT_ID IN (85, 86)
			LEFT JOIN (
				SELECT
					CRDDET_ID,
					NVL(SUM(CASE
						WHEN NVL(LOADTYPE, 0) = 0 AND NVL(LOADSRC, 0) = 0
							AND NVL(TXNCODE, 0) = 210 AND TRIM(NVL(DESCRIPTION, ' ')) IS NULL
						THEN 0 ELSE AMTAVL
					END), 0) AS SUM_AMTAVL,
					NVL(SUM(CASE
						WHEN NVL(LOADTYPE, 0) = 0 AND NVL(LOADSRC, 0) = 0
							AND NVL(TXNCODE, 0) = 210 AND TRIM(NVL(DESCRIPTION, ' ')) IS NULL
						THEN AMTAVL ELSE 0
					END), 0) AS SUM_UNLOAD_AMTAVL
				FROM cortex.accitems
				GROUP BY CRDDET_ID
			) amt ON amt.CRDDET_ID = sib.CRDDET_ID
			LEFT JOIN (
				SELECT
					CRDDET_ID,
					NVL(SUM(AMTBILL), 0) AS TOPUP_AMOUNT
				FROM cortex.accitems
				WHERE LOADTYPE = 50
					AND LOADSRC = 50
					AND NVL(REV, 0) = 0
				GROUP BY CRDDET_ID
			) tops ON tops.CRDDET_ID = sib.CRDDET_ID
			WHERE sib.ACCDET_ID IS NOT NULL
			GROUP BY sib.ACCDET_ID
		) wallet ON wallet.ACCDET_ID = ca.ACCDET_ID
		WHERE c.ID = :card_id
			AND c.CRDPRODUCT_ID IN (85, 86)
	`, cardholder)

	var (
		id, linkedCards                                sql.NullInt64
		cardMasked, holder, productCode, productName   sql.NullString
		statusCode, statusDesc, branchCode, branchName sql.NullString
		availBal, override, blocked, unclear           sql.NullFloat64
		availAmt, fromAvailable, unloaded, topUp       sql.NullFloat64
	)
	err := r.db.QueryRowContext(ctx, cardQ, sql.Named("card_id", cardID)).Scan(
		&id, &cardMasked, &holder,
		&productCode, &productName,
		&statusCode, &statusDesc,
		&branchCode, &branchName,
		&availBal, &override, &blocked, &unclear,
		&availAmt, &fromAvailable, &unloaded, &topUp,
		&linkedCards,
	)
	if err == sql.ErrNoRows {
		return nil, common.ErrPrepaidVisaCardNotFound
	}
	if err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}

	expected := availAmt.Float64 + blocked.Float64 + fromAvailable.Float64 + unloaded.Float64
	variance := topUp.Float64 - expected
	matched := variance <= prepaidVisaReconcileTolerance && variance >= -prepaidVisaReconcileTolerance
	card := model.PrepaidVisaCardReconcile{
		CardID:            id.Int64,
		CardMasked:        cardMasked.String,
		CardholderName:    holder.String,
		ProductCode:       productCode.String,
		ProductName:       productName.String,
		StatusCode:        statusCode.String,
		StatusDescription: statusDesc.String,
		BranchCode:        branchCode.String,
		BranchName:        branchName.String,
		AvailableBalance:  availBal.Float64,
		OverrideAmount:    override.Float64,
		BlockedBalance:    blocked.Float64,
		UnclearCredit:     unclear.Float64,
		AvailableAmount:   availAmt.Float64,
		FromAvailable:     fromAvailable.Float64,
		Unloaded:          unloaded.Float64,
		TopUpAmount:       topUp.Float64,
		LinkedCards:       int(linkedCards.Int64),
		Expected:          expected,
		Variance:          variance,
		Matched:           matched,
	}

	out := &model.PrepaidVisaCardActivity{
		Card:         card,
		TopUps:       []model.PrepaidVisaTopUp{},
		Unloads:      []model.PrepaidVisaUnload{},
		Transactions: []model.PrepaidVisaTransaction{},
		Ledger:       []model.PrepaidVisaLedgerItem{},
	}

	walletCardIDs, err := r.prepaidVisaWalletCardIDs(ctx, cardID)
	if err != nil {
		return nil, err
	}
	cardIDIn := prepaidVisaCardIDInList(walletCardIDs)

	_, pageSize = normalizePrepaidVisaActivityPage(1, pageSize)
	topUpPage, _ = normalizePrepaidVisaActivityPage(topUpPage, pageSize)
	unloadPage, _ = normalizePrepaidVisaActivityPage(unloadPage, pageSize)
	ledgerPage, _ = normalizePrepaidVisaActivityPage(ledgerPage, pageSize)
	txnPage, _ = normalizePrepaidVisaActivityPage(txnPage, pageSize)
	section := strings.ToLower(strings.TrimSpace(sections))
	loadAll := section == "" || section == "all"
	loadLedger := loadAll || section == "ledger"
	loadTopUps := loadAll || section == "topups" || section == "top-ups"
	loadUnloads := loadAll || section == "unloads" || section == "unload"
	loadTxns := loadAll || section == "transactions" || section == "txns"

	if loadLedger {
		offset := (ledgerPage - 1) * pageSize
		fetchLimit := pageSize + 1
		ledgerRows, err := r.db.QueryContext(ctx, `
			SELECT
				i.ID,
				i.CRDDET_ID,
				SUBSTR(c.PAN_DISPLAY, 1, 6) || 'XXXXXX' || SUBSTR(c.PAN_DISPLAY, -4),
				TO_CHAR(i.CTXDATE, 'YYYY-MM-DD'),
				CASE
					WHEN i.TIMELOCAL IS NULL THEN ''
					ELSE SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 1, 2)
						|| ':' || SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 3, 2)
						|| ':' || SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 5, 2)
				END,
				NVL(i.REV, 0),
				NVL(i.LOADTYPE, -1),
				NVL(i.LOADSRC, -1),
				NVL(i.TXNCODE, 0),
				TRIM(i.DESCRIPTION),
				NVL(i.AMTBILL, 0),
				NVL(i.AMTAVL, 0),
				NVL(i.AMTBLK, 0),
				NVL(i.AVLBAL, 0),
				NVL(i.BLKAMT, 0)
			FROM cortex.accitems i
			JOIN cortex.crddet c ON c.ID = i.CRDDET_ID
			WHERE i.CRDDET_ID IN (`+cardIDIn+`)
			ORDER BY i.CTXDATE DESC, i.ID DESC
			OFFSET :offset ROWS FETCH NEXT :fetch_limit ROWS ONLY
		`, sql.Named("offset", offset), sql.Named("fetch_limit", fetchLimit))
		if err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}
		defer func() { _ = ledgerRows.Close() }()
		ledgerBuf := make([]model.PrepaidVisaLedgerItem, 0, fetchLimit)
		for ledgerRows.Next() {
			var (
				itemID, ledCardID, rev, loadType, loadSrc, txnCode sql.NullInt64
				ledCardMasked, date, time, desc                    sql.NullString
				amount, dAvl, dBlk, avlAfter, blkAfter             sql.NullFloat64
			)
			if err := ledgerRows.Scan(
				&itemID, &ledCardID, &ledCardMasked, &date, &time, &rev,
				&loadType, &loadSrc, &txnCode, &desc,
				&amount, &dAvl, &dBlk, &avlAfter, &blkAfter,
			); err != nil {
				return nil, wrapError(common.ErrFailedToFetchReport, err)
			}
			kind := "other"
			descText := strings.TrimSpace(desc.String)
			switch {
			case rev.Int64 != 0:
				kind = "reversal"
			case loadType.Int64 == 50:
				kind = "top-up"
			case prepaidVisaIsUnload(loadType.Int64, loadSrc.Int64, txnCode.Int64, descText):
				kind = "unload"
				if descText == "" {
					descText = "Account unload"
				}
			case loadType.Int64 == 0:
				kind = "spend"
			}
			amt := amount.Float64
			if rev.Int64 != 0 {
				amt = -amt
			}
			ledgerBuf = append(ledgerBuf, model.PrepaidVisaLedgerItem{
				AccItemID:      itemID.Int64,
				CardID:         ledCardID.Int64,
				CardMasked:     ledCardMasked.String,
				Date:           date.String,
				Time:           time.String,
				Kind:           kind,
				Description:    descText,
				Amount:         amt,
				AvailableDelta: dAvl.Float64,
				BlockedDelta:   dBlk.Float64,
				AvailableAfter: avlAfter.Float64,
				BlockedAfter:   blkAfter.Float64,
			})
		}
		if err := ledgerRows.Err(); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}
		pageRows, hasMore := trimPrepaidVisaPage(ledgerBuf, pageSize)
		out.Ledger = pageRows
		out.LedgerHasMore = hasMore
	}

	if loadTopUps {
		offset := (topUpPage - 1) * pageSize
		fetchLimit := pageSize + 1
		topRows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
			SELECT
				%s,
				TRIM(c.CUST_ID_NUM) AS CUSTOMER_ID,
				TRIM(a.ACCNO) AS ACCOUNT_NUMBER,
				NVL(i.AMTBILL, 0) AS AMOUNT,
				TRIM(TO_CHAR(NVL(i.CURBILL, i.CURTXN))) AS CURRENCY,
				TRIM(i.DESCRIPTION) AS DESCRIPTION,
				TO_CHAR(i.TXNCODE) AS TXN_CODE,
				TO_CHAR(i.CTXDATE, 'YYYY-MM-DD') AS TXN_DATE,
				CASE
					WHEN i.TIMELOCAL IS NULL THEN ''
					ELSE SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 1, 2)
						|| ':' || SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 3, 2)
						|| ':' || SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 5, 2)
				END AS TXN_TIME,
				i.TLOGID AS TLOG_ID,
				i.ID AS ACC_ITEM_ID
			FROM cortex.accitems i
			JOIN cortex.crddet c ON c.ID = i.CRDDET_ID
			LEFT JOIN cortex.crdproduct p ON p.ID = c.CRDPRODUCT_ID
			LEFT JOIN cortex.crdstatus s ON TRIM(c.STATCODE) = TRIM(s.STATCODE)
			LEFT JOIN cortex.branch b ON b.ID = c.BRANCH_ID
			LEFT JOIN cortex.crdacc ca ON ca.CRDDET_ID = c.ID
			LEFT JOIN cortex.accdet a ON a.ID = ca.ACCDET_ID
			%s
			WHERE i.CRDDET_ID IN (%s)
				AND i.LOADTYPE = 50
				AND i.LOADSRC = 50
				AND NVL(i.REV, 0) = 0
			ORDER BY i.CTXDATE DESC, i.ID DESC
			OFFSET :offset ROWS FETCH NEXT :fetch_limit ROWS ONLY
		`, fmt.Sprintf(prepaidVisaCardSelect, cardholder), prepaidVisaAmtJoin, cardIDIn),
			sql.Named("offset", offset),
			sql.Named("fetch_limit", fetchLimit),
		)
		if err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}
		defer func() { _ = topRows.Close() }()
		topBuf := make([]model.PrepaidVisaTopUp, 0, fetchLimit)
		for topRows.Next() {
			var (
				cardIDCol                                        sql.NullInt64
				cardMasked2, holder2, productCode2, productName2 sql.NullString
				statusCode2, statusDesc2, branchCode2, branchName2 sql.NullString
				availBal2, availAmt2, blockedBal2, fromAvailable2, unloaded2 sql.NullFloat64
				acctCurr, customerID, acctNo                     sql.NullString
				amount                                           sql.NullFloat64
				currency, description, txnCode, date, time       sql.NullString
				tlogID, accItemID                                sql.NullInt64
			)
			if err := topRows.Scan(
				&cardIDCol, &cardMasked2, &holder2,
				&productCode2, &productName2,
				&statusCode2, &statusDesc2,
				&branchCode2, &branchName2,
				&availBal2, &availAmt2, &blockedBal2, &fromAvailable2, &unloaded2, &acctCurr,
				&customerID, &acctNo,
				&amount, &currency, &description, &txnCode,
				&date, &time, &tlogID, &accItemID,
			); err != nil {
				return nil, wrapError(common.ErrFailedToFetchReport, err)
			}
			row := model.PrepaidVisaTopUp{
				CardID:            cardIDCol.Int64,
				CardMasked:        cardMasked2.String,
				CustomerID:        customerID.String,
				CardholderName:    holder2.String,
				ProductCode:       productCode2.String,
				ProductName:       productName2.String,
				StatusCode:        statusCode2.String,
				StatusDescription: statusDesc2.String,
				BranchCode:        branchCode2.String,
				BranchName:        branchName2.String,
				AvailableBalance:  availBal2.Float64,
				AvailableAmount:   availAmt2.Float64,
				BlockedBalance:    blockedBal2.Float64,
				FromAvailable:     fromAvailable2.Float64,
				AccountCurrency:   acctCurr.String,
				AccountNumber:     acctNo.String,
				Amount:            amount.Float64,
				Currency:          currency.String,
				Description:       description.String,
				TxnCode:           txnCode.String,
				Date:              date.String,
				Time:              time.String,
				AccItemID:         accItemID.Int64,
			}
			if tlogID.Valid {
				v := tlogID.Int64
				row.TlogID = &v
			}
			topBuf = append(topBuf, row)
		}
		if err := topRows.Err(); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}
		pageRows, hasMore := trimPrepaidVisaPage(topBuf, pageSize)
		out.TopUps = pageRows
		out.TopUpsHasMore = hasMore
	}

	if loadUnloads {
		offset := (unloadPage - 1) * pageSize
		fetchLimit := pageSize + 1
		unloadRows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
			SELECT
				%s,
				TRIM(a.ACCNO) AS ACCOUNT_NUMBER,
				NVL(i.AMTBILL, 0) AS AMOUNT,
				TRIM(TO_CHAR(NVL(i.CURBILL, i.CURTXN))) AS CURRENCY,
				TRIM(i.DESCRIPTION) AS DESCRIPTION,
				TO_CHAR(i.TXNCODE) AS TXN_CODE,
				TO_CHAR(i.CTXDATE, 'YYYY-MM-DD') AS TXN_DATE,
				CASE
					WHEN i.TIMELOCAL IS NULL THEN ''
					ELSE SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 1, 2)
						|| ':' || SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 3, 2)
						|| ':' || SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 5, 2)
				END AS TXN_TIME,
				i.TLOGID AS TLOG_ID,
				i.ID AS ACC_ITEM_ID
			FROM cortex.accitems i
			JOIN cortex.crddet c ON c.ID = i.CRDDET_ID
			LEFT JOIN cortex.crdproduct p ON p.ID = c.CRDPRODUCT_ID
			LEFT JOIN cortex.crdstatus s ON TRIM(c.STATCODE) = TRIM(s.STATCODE)
			LEFT JOIN cortex.branch b ON b.ID = c.BRANCH_ID
			LEFT JOIN cortex.crdacc ca ON ca.CRDDET_ID = c.ID
			LEFT JOIN cortex.accdet a ON a.ID = ca.ACCDET_ID
			%s
			WHERE i.CRDDET_ID IN (%s)
				AND `+prepaidVisaUnloadPredI+`
				AND NVL(i.REV, 0) = 0
			ORDER BY i.CTXDATE DESC, i.ID DESC
			OFFSET :offset ROWS FETCH NEXT :fetch_limit ROWS ONLY
		`, fmt.Sprintf(prepaidVisaCardSelect, cardholder), prepaidVisaAmtJoin, cardIDIn),
			sql.Named("offset", offset),
			sql.Named("fetch_limit", fetchLimit),
		)
		if err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}
		defer func() { _ = unloadRows.Close() }()
		unloadBuf := make([]model.PrepaidVisaUnload, 0, fetchLimit)
		for unloadRows.Next() {
			var (
				cardIDCol                                          sql.NullInt64
				cardMasked2, holder2, productCode2, productName2   sql.NullString
				statusCode2, statusDesc2, branchCode2, branchName2 sql.NullString
				availBal2, availAmt2, blockedBal2, fromAvailable2, unloaded2 sql.NullFloat64
				acctCurr, acctNo                                   sql.NullString
				amount                                             sql.NullFloat64
				currency, description, txnCode, date, time         sql.NullString
				tlogID, accItemID                                  sql.NullInt64
			)
			if err := unloadRows.Scan(
				&cardIDCol, &cardMasked2, &holder2,
				&productCode2, &productName2,
				&statusCode2, &statusDesc2,
				&branchCode2, &branchName2,
				&availBal2, &availAmt2, &blockedBal2, &fromAvailable2, &unloaded2, &acctCurr, &acctNo,
				&amount, &currency, &description, &txnCode,
				&date, &time, &tlogID, &accItemID,
			); err != nil {
				return nil, wrapError(common.ErrFailedToFetchReport, err)
			}
			descText := strings.TrimSpace(description.String)
			if descText == "" {
				descText = "Account unload"
			}
			row := model.PrepaidVisaUnload{
				CardID:            cardIDCol.Int64,
				CardMasked:        cardMasked2.String,
				CardholderName:    holder2.String,
				ProductCode:       productCode2.String,
				ProductName:       productName2.String,
				StatusCode:        statusCode2.String,
				StatusDescription: statusDesc2.String,
				BranchCode:        branchCode2.String,
				BranchName:        branchName2.String,
				AvailableBalance:  availBal2.Float64,
				AvailableAmount:   availAmt2.Float64,
				BlockedBalance:    blockedBal2.Float64,
				FromAvailable:     fromAvailable2.Float64,
				Unloaded:          unloaded2.Float64,
				AccountCurrency:   acctCurr.String,
				AccountNumber:     acctNo.String,
				Amount:            amount.Float64,
				Currency:          currency.String,
				Description:       descText,
				TxnCode:           txnCode.String,
				Date:              date.String,
				Time:              time.String,
				AccItemID:         accItemID.Int64,
			}
			if tlogID.Valid {
				v := tlogID.Int64
				row.TlogID = &v
			}
			unloadBuf = append(unloadBuf, row)
		}
		if err := unloadRows.Err(); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}
		pageRows, hasMore := trimPrepaidVisaPage(unloadBuf, pageSize)
		out.Unloads = pageRows
		out.UnloadsHasMore = hasMore
	}

	if loadTxns {
		offset := (txnPage - 1) * pageSize
		fetchLimit := pageSize + 1
		txnRows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
			SELECT
				%s,
				%s AS AMOUNT,
				TRIM(TO_CHAR(t.CURBILL)) AS CURRENCY,
				%s AS AMOUNT_TXN,
				TRIM(TO_CHAR(t.CURTXN)) AS TXN_CURRENCY,
				TO_CHAR(t.TXNCODE) AS TXN_CODE,
				TRIM(TO_CHAR(t.MSGCLS)) AS MSG_TYPE,
				TRIM(t.RSPCODE) AS RSP_CODE,
				TRIM(t.RRN) AS RRN,
				TRIM(t.TERMCODE) AS TERMINAL_ID,
				TRIM(t.CRDACPTLOC) AS MERCHANT_NAME,
				TRIM(t.CRDACPTID) AS MERCHANT_ID,
				TO_CHAR(t.CTXDATE, 'YYYY-MM-DD') AS TXN_DATE,
				CASE
					WHEN t.TIMELOCAL IS NULL THEN ''
					ELSE SUBSTR(LPAD(TO_CHAR(t.TIMELOCAL), 6, '0'), 1, 2)
						|| ':' || SUBSTR(LPAD(TO_CHAR(t.TIMELOCAL), 6, '0'), 3, 2)
						|| ':' || SUBSTR(LPAD(TO_CHAR(t.TIMELOCAL), 6, '0'), 5, 2)
				END AS TXN_TIME,
				t.ID AS TLOG_ID
			FROM cortex.tlog t
			JOIN cortex.crddet c ON c.ID = t.CRDDET_ID
			LEFT JOIN cortex.crdproduct p ON p.ID = c.CRDPRODUCT_ID
			LEFT JOIN cortex.crdstatus s ON TRIM(c.STATCODE) = TRIM(s.STATCODE)
			LEFT JOIN cortex.branch b ON b.ID = c.BRANCH_ID
			LEFT JOIN cortex.crdacc ca ON ca.CRDDET_ID = c.ID
			LEFT JOIN cortex.accdet a ON a.ID = ca.ACCDET_ID
			%s
			WHERE t.CRDDET_ID IN (%s)
			ORDER BY t.CTXDATE DESC, t.ID DESC
			OFFSET :offset ROWS FETCH NEXT :fetch_limit ROWS ONLY
		`, fmt.Sprintf(prepaidVisaCardSelect, cardholder), prepaidVisaSignedAmtBill, prepaidVisaSignedAmtTxn, prepaidVisaAmtJoin, cardIDIn),
			sql.Named("offset", offset),
			sql.Named("fetch_limit", fetchLimit),
		)
		if err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}
		defer func() { _ = txnRows.Close() }()
		txnBuf := make([]model.PrepaidVisaTransaction, 0, fetchLimit)
		for txnRows.Next() {
			var (
				cardIDCol                                        sql.NullInt64
				cardMasked2, holder2, productCode2, productName2 sql.NullString
				statusCode2, statusDesc2, branchCode2, branchName2 sql.NullString
				availBal2, availAmt2, blockedBal2, fromAvailable2, unloaded2 sql.NullFloat64
				acctCurr                                         sql.NullString
				amount, amountTxn                                sql.NullFloat64
				currency, txnCurrency                            sql.NullString
				txnCode, msgType, rspCode                        sql.NullString
				rrn, termID, merchant, merchantID                sql.NullString
				date, time                                       sql.NullString
				tlogID                                           sql.NullInt64
			)
			if err := txnRows.Scan(
				&cardIDCol, &cardMasked2, &holder2,
				&productCode2, &productName2,
				&statusCode2, &statusDesc2,
				&branchCode2, &branchName2,
				&availBal2, &availAmt2, &blockedBal2, &fromAvailable2, &unloaded2, &acctCurr,
				&amount, &currency, &amountTxn, &txnCurrency,
				&txnCode, &msgType, &rspCode,
				&rrn, &termID, &merchant, &merchantID,
				&date, &time, &tlogID,
			); err != nil {
				return nil, wrapError(common.ErrFailedToFetchReport, err)
			}
			txnBuf = append(txnBuf, model.PrepaidVisaTransaction{
				CardID:            cardIDCol.Int64,
				CardMasked:        cardMasked2.String,
				CardholderName:    holder2.String,
				ProductCode:       productCode2.String,
				ProductName:       productName2.String,
				StatusCode:        statusCode2.String,
				StatusDescription: statusDesc2.String,
				BranchCode:        branchCode2.String,
				BranchName:        branchName2.String,
				AvailableBalance:  availBal2.Float64,
				AvailableAmount:   availAmt2.Float64,
				BlockedBalance:    blockedBal2.Float64,
				FromAvailable:     fromAvailable2.Float64,
				AccountCurrency:   acctCurr.String,
				Amount:            amount.Float64,
				Currency:          currency.String,
				AmountTxn:         amountTxn.Float64,
				TxnCurrency:       txnCurrency.String,
				TxnCode:           txnCode.String,
				MsgType:           msgType.String,
				RspCode:           rspCode.String,
				Approved:          rspCode.String == "00",
				RRN:               rrn.String,
				TerminalID:        termID.String,
				MerchantName:      merchant.String,
				MerchantID:        merchantID.String,
				Date:              date.String,
				Time:              time.String,
				TlogID:            tlogID.Int64,
			})
		}
		if err := txnRows.Err(); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}
		pageRows, hasMore := trimPrepaidVisaPage(txnBuf, pageSize)
		out.Transactions = pageRows
		out.TransactionsHasMore = hasMore
	}

	return out, nil
}

func (r *prepaidVisaRepository) ListTopUps(
	ctx context.Context,
	filter model.PrepaidVisaListFilter,
	includeCardholder bool,
	page, pageSize int,
) ([]model.PrepaidVisaTopUp, bool, error) {
	cardholder := prepaidVisaCardholderNull
	if includeCardholder {
		cardholder = prepaidVisaCardholderPermitted
	}
	ids := prepaidVisaProductIDList(filter.Product)
	page, pageSize = normalizePrepaidVisaPage(page, pageSize)
	offset := (page - 1) * pageSize
	fetchLimit := pageSize + 1

	dateSQL, dateArgs := prepaidVisaLedgerDateClause("i", filter.DateFrom, filter.DateTo)

	// Drive from accitems + date so Oracle can use the activity index first,
	// then restrict to prepaid product IDs on crddet.
	q := fmt.Sprintf(`
		SELECT
			%s,
			TRIM(c.CUST_ID_NUM) AS CUSTOMER_ID,
			TRIM(a.ACCNO) AS ACCOUNT_NUMBER,
			NVL(i.AMTBILL, 0) AS AMOUNT,
			TRIM(TO_CHAR(NVL(i.CURBILL, i.CURTXN))) AS CURRENCY,
			TRIM(i.DESCRIPTION) AS DESCRIPTION,
			TO_CHAR(i.TXNCODE) AS TXN_CODE,
			TO_CHAR(i.CTXDATE, 'YYYY-MM-DD') AS TXN_DATE,
			CASE
				WHEN i.TIMELOCAL IS NULL THEN ''
				ELSE SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 1, 2)
					|| ':' || SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 3, 2)
					|| ':' || SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 5, 2)
			END AS TXN_TIME,
			i.TLOGID AS TLOG_ID,
			i.ID AS ACC_ITEM_ID
		FROM cortex.accitems i
		JOIN cortex.crddet c
			ON c.ID = i.CRDDET_ID
			AND c.CRDPRODUCT_ID IN (%s)
		LEFT JOIN cortex.crdproduct p ON p.ID = c.CRDPRODUCT_ID
		LEFT JOIN cortex.crdstatus s ON TRIM(c.STATCODE) = TRIM(s.STATCODE)
		LEFT JOIN cortex.branch b ON b.ID = c.BRANCH_ID
		LEFT JOIN cortex.crdacc ca ON ca.CRDDET_ID = c.ID
		LEFT JOIN cortex.accdet a ON a.ID = ca.ACCDET_ID
		%s
		WHERE i.LOADTYPE = 50
			AND i.LOADSRC = 50
			AND NVL(i.REV, 0) = 0
			%s
		ORDER BY i.CTXDATE DESC, i.ID DESC
		OFFSET :offset ROWS
		FETCH NEXT :fetch_limit ROWS ONLY
	`,
		fmt.Sprintf(prepaidVisaCardSelect, cardholder),
		ids,
		prepaidVisaAmtJoin,
		dateSQL,
	)

	queryArgs := append([]any{}, dateArgs...)
	queryArgs = append(queryArgs,
		sql.Named("offset", offset),
		sql.Named("fetch_limit", fetchLimit),
	)
	rows, err := r.db.QueryContext(ctx, q, queryArgs...)
	if err != nil {
		return nil, false, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	results, err := scanPrepaidVisaTopUps(rows)
	if err != nil {
		return nil, false, err
	}
	pageRows, hasMore := trimPrepaidVisaPage(results, pageSize)
	return pageRows, hasMore, nil
}

func (r *prepaidVisaRepository) ListUnloads(
	ctx context.Context,
	filter model.PrepaidVisaListFilter,
	includeCardholder bool,
	page, pageSize int,
) ([]model.PrepaidVisaUnload, bool, error) {
	cardholder := prepaidVisaCardholderNull
	if includeCardholder {
		cardholder = prepaidVisaCardholderPermitted
	}
	ids := prepaidVisaProductIDList(filter.Product)
	page, pageSize = normalizePrepaidVisaPage(page, pageSize)
	offset := (page - 1) * pageSize
	fetchLimit := pageSize + 1

	dateSQL, dateArgs := prepaidVisaLedgerDateClause("i", filter.DateFrom, filter.DateTo)

	q := fmt.Sprintf(`
		SELECT
			%s,
			TRIM(a.ACCNO) AS ACCOUNT_NUMBER,
			NVL(i.AMTBILL, 0) AS AMOUNT,
			TRIM(TO_CHAR(NVL(i.CURBILL, i.CURTXN))) AS CURRENCY,
			TRIM(i.DESCRIPTION) AS DESCRIPTION,
			TO_CHAR(i.TXNCODE) AS TXN_CODE,
			TO_CHAR(i.CTXDATE, 'YYYY-MM-DD') AS TXN_DATE,
			CASE
				WHEN i.TIMELOCAL IS NULL THEN ''
				ELSE SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 1, 2)
					|| ':' || SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 3, 2)
					|| ':' || SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 5, 2)
			END AS TXN_TIME,
			i.TLOGID AS TLOG_ID,
			i.ID AS ACC_ITEM_ID
		FROM cortex.accitems i
		JOIN cortex.crddet c
			ON c.ID = i.CRDDET_ID
			AND c.CRDPRODUCT_ID IN (%s)
		LEFT JOIN cortex.crdproduct p ON p.ID = c.CRDPRODUCT_ID
		LEFT JOIN cortex.crdstatus s ON TRIM(c.STATCODE) = TRIM(s.STATCODE)
		LEFT JOIN cortex.branch b ON b.ID = c.BRANCH_ID
		LEFT JOIN cortex.crdacc ca ON ca.CRDDET_ID = c.ID
		LEFT JOIN cortex.accdet a ON a.ID = ca.ACCDET_ID
		%s
		WHERE `+prepaidVisaUnloadPredI+`
			AND NVL(i.REV, 0) = 0
			%s
		ORDER BY i.CTXDATE DESC, i.ID DESC
		OFFSET :offset ROWS
		FETCH NEXT :fetch_limit ROWS ONLY
	`,
		fmt.Sprintf(prepaidVisaCardSelect, cardholder),
		ids,
		prepaidVisaAmtJoin,
		dateSQL,
	)

	queryArgs := append([]any{}, dateArgs...)
	queryArgs = append(queryArgs,
		sql.Named("offset", offset),
		sql.Named("fetch_limit", fetchLimit),
	)
	rows, err := r.db.QueryContext(ctx, q, queryArgs...)
	if err != nil {
		return nil, false, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	results, err := scanPrepaidVisaUnloads(rows)
	if err != nil {
		return nil, false, err
	}
	pageRows, hasMore := trimPrepaidVisaPage(results, pageSize)
	return pageRows, hasMore, nil
}

func (r *prepaidVisaRepository) ListTransactions(
	ctx context.Context,
	filter model.PrepaidVisaListFilter,
	includeCardholder bool,
	page, pageSize int,
) ([]model.PrepaidVisaTransaction, bool, error) {
	cardholder := prepaidVisaCardholderNull
	if includeCardholder {
		cardholder = prepaidVisaCardholderPermitted
	}
	page, pageSize = normalizePrepaidVisaPage(page, pageSize)
	offset := (page - 1) * pageSize
	fetchLimit := pageSize + 1

	dateSQL, dateArgs := prepaidVisaLedgerDateClause("t", filter.DateFrom, filter.DateTo)

	q := fmt.Sprintf(`
		SELECT
			%s,
			%s AS AMOUNT,
			TRIM(TO_CHAR(t.CURBILL)) AS CURRENCY,
			%s AS AMOUNT_TXN,
			TRIM(TO_CHAR(t.CURTXN)) AS TXN_CURRENCY,
			TO_CHAR(t.TXNCODE) AS TXN_CODE,
			TRIM(TO_CHAR(t.MSGCLS)) AS MSG_TYPE,
			TRIM(t.RSPCODE) AS RSP_CODE,
			TRIM(t.RRN) AS RRN,
			TRIM(t.TERMCODE) AS TERMINAL_ID,
			TRIM(t.CRDACPTLOC) AS MERCHANT_NAME,
			TRIM(t.CRDACPTID) AS MERCHANT_ID,
			TO_CHAR(t.CTXDATE, 'YYYY-MM-DD') AS TXN_DATE,
			CASE
				WHEN t.TIMELOCAL IS NULL THEN ''
				ELSE SUBSTR(LPAD(TO_CHAR(t.TIMELOCAL), 6, '0'), 1, 2)
					|| ':' || SUBSTR(LPAD(TO_CHAR(t.TIMELOCAL), 6, '0'), 3, 2)
					|| ':' || SUBSTR(LPAD(TO_CHAR(t.TIMELOCAL), 6, '0'), 5, 2)
			END AS TXN_TIME,
			t.ID AS TLOG_ID
		FROM cortex.tlog t
		JOIN cortex.crddet c ON c.ID = t.CRDDET_ID
		LEFT JOIN cortex.crdproduct p ON p.ID = c.CRDPRODUCT_ID
		LEFT JOIN cortex.crdstatus s ON TRIM(c.STATCODE) = TRIM(s.STATCODE)
		LEFT JOIN cortex.branch b ON b.ID = c.BRANCH_ID
		LEFT JOIN cortex.crdacc ca ON ca.CRDDET_ID = c.ID
		LEFT JOIN cortex.accdet a ON a.ID = ca.ACCDET_ID
		%s
		WHERE 1=1
			%s
			%s
		ORDER BY t.CTXDATE DESC, t.ID DESC
		OFFSET :offset ROWS
		FETCH NEXT :fetch_limit ROWS ONLY
	`,
		fmt.Sprintf(prepaidVisaCardSelect, cardholder),
		prepaidVisaSignedAmtBill,
		prepaidVisaSignedAmtTxn,
		prepaidVisaAmtJoin,
		dateSQL,
		prepaidVisaTlogProductPred(filter.Product),
	)

	queryArgs := append([]any{}, dateArgs...)
	queryArgs = append(queryArgs,
		sql.Named("offset", offset),
		sql.Named("fetch_limit", fetchLimit),
	)
	rows, err := r.db.QueryContext(ctx, q, queryArgs...)
	if err != nil {
		return nil, false, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	results, err := scanPrepaidVisaTransactions(rows)
	if err != nil {
		return nil, false, err
	}
	pageRows, hasMore := trimPrepaidVisaPage(results, pageSize)
	return pageRows, hasMore, nil
}

func (r *prepaidVisaRepository) Search(
	ctx context.Context,
	req model.PrepaidVisaSearchRequest,
	includeCardholder bool,
	page, pageSize int,
) (*model.PrepaidVisaSearchResult, error) {
	page, pageSize = normalizePrepaidVisaPage(page, pageSize)
	out := &model.PrepaidVisaSearchResult{
		Kind:     req.Kind,
		Page:     page,
		PageSize: pageSize,
	}

	switch req.Kind {
	case model.PrepaidVisaSearchKindTopUps:
		rows, hasMore, err := r.searchTopUps(ctx, req, includeCardholder, page, pageSize)
		if err != nil {
			return nil, err
		}
		out.TopUps = rows
		out.HasMore = hasMore
	case model.PrepaidVisaSearchKindUnloads:
		rows, hasMore, err := r.searchUnloads(ctx, req, includeCardholder, page, pageSize)
		if err != nil {
			return nil, err
		}
		out.Unloads = rows
		out.HasMore = hasMore
	case model.PrepaidVisaSearchKindTransactions:
		rows, hasMore, err := r.searchTransactions(ctx, req, includeCardholder, page, pageSize)
		if err != nil {
			return nil, err
		}
		out.Transactions = rows
		out.HasMore = hasMore
	default:
		return nil, common.ErrInvalidPrepaidVisaSearchKind
	}
	return out, nil
}

func (r *prepaidVisaRepository) searchTopUps(
	ctx context.Context,
	req model.PrepaidVisaSearchRequest,
	includeCardholder bool,
	page, pageSize int,
) ([]model.PrepaidVisaTopUp, bool, error) {
	cardholder := prepaidVisaCardholderNull
	if includeCardholder {
		cardholder = prepaidVisaCardholderPermitted
	}
	ids := prepaidVisaProductIDList(req.Product)
	offset := (page - 1) * pageSize
	fetchLimit := pageSize + 1

	dateSQL, dateArgs := prepaidVisaLedgerDateClause("i", req.DateFrom, req.DateTo)
	commonSQL, commonArgs := prepaidVisaSearchCommonClause(req, includeCardholder, prepaidVisaLedgerSearchQCols(includeCardholder))
	extraSQL, extraArgs := prepaidVisaLedgerExtraSearchClause(req)

	q := fmt.Sprintf(`
		SELECT
			%s,
			TRIM(c.CUST_ID_NUM) AS CUSTOMER_ID,
			TRIM(a.ACCNO) AS ACCOUNT_NUMBER,
			NVL(i.AMTBILL, 0) AS AMOUNT,
			TRIM(TO_CHAR(NVL(i.CURBILL, i.CURTXN))) AS CURRENCY,
			TRIM(i.DESCRIPTION) AS DESCRIPTION,
			TO_CHAR(i.TXNCODE) AS TXN_CODE,
			TO_CHAR(i.CTXDATE, 'YYYY-MM-DD') AS TXN_DATE,
			CASE
				WHEN i.TIMELOCAL IS NULL THEN ''
				ELSE SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 1, 2)
					|| ':' || SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 3, 2)
					|| ':' || SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 5, 2)
			END AS TXN_TIME,
			i.TLOGID AS TLOG_ID,
			i.ID AS ACC_ITEM_ID
		FROM cortex.accitems i
		JOIN cortex.crddet c
			ON c.ID = i.CRDDET_ID
			AND c.CRDPRODUCT_ID IN (%s)
		LEFT JOIN cortex.crdproduct p ON p.ID = c.CRDPRODUCT_ID
		LEFT JOIN cortex.crdstatus s ON TRIM(c.STATCODE) = TRIM(s.STATCODE)
		LEFT JOIN cortex.branch b ON b.ID = c.BRANCH_ID
		LEFT JOIN cortex.crdacc ca ON ca.CRDDET_ID = c.ID
		LEFT JOIN cortex.accdet a ON a.ID = ca.ACCDET_ID
		%s
		WHERE i.LOADTYPE = 50
			AND i.LOADSRC = 50
			AND NVL(i.REV, 0) = 0
			%s
			%s
			%s
		ORDER BY i.CTXDATE DESC, i.ID DESC
		OFFSET :offset ROWS
		FETCH NEXT :fetch_limit ROWS ONLY
	`,
		fmt.Sprintf(prepaidVisaCardSelect, cardholder),
		ids,
		prepaidVisaAmtJoin,
		dateSQL,
		commonSQL,
		extraSQL,
	)

	queryArgs := append([]any{}, dateArgs...)
	queryArgs = append(queryArgs, commonArgs...)
	queryArgs = append(queryArgs, extraArgs...)
	queryArgs = append(queryArgs,
		sql.Named("offset", offset),
		sql.Named("fetch_limit", fetchLimit),
	)
	rows, err := r.db.QueryContext(ctx, q, queryArgs...)
	if err != nil {
		return nil, false, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	results, err := scanPrepaidVisaTopUps(rows)
	if err != nil {
		return nil, false, err
	}
	pageRows, hasMore := trimPrepaidVisaPage(results, pageSize)
	return pageRows, hasMore, nil
}

func (r *prepaidVisaRepository) searchUnloads(
	ctx context.Context,
	req model.PrepaidVisaSearchRequest,
	includeCardholder bool,
	page, pageSize int,
) ([]model.PrepaidVisaUnload, bool, error) {
	cardholder := prepaidVisaCardholderNull
	if includeCardholder {
		cardholder = prepaidVisaCardholderPermitted
	}
	ids := prepaidVisaProductIDList(req.Product)
	offset := (page - 1) * pageSize
	fetchLimit := pageSize + 1

	dateSQL, dateArgs := prepaidVisaLedgerDateClause("i", req.DateFrom, req.DateTo)
	commonSQL, commonArgs := prepaidVisaSearchCommonClause(req, includeCardholder, prepaidVisaLedgerSearchQCols(includeCardholder))
	extraSQL, extraArgs := prepaidVisaLedgerExtraSearchClause(req)

	q := fmt.Sprintf(`
		SELECT
			%s,
			TRIM(a.ACCNO) AS ACCOUNT_NUMBER,
			NVL(i.AMTBILL, 0) AS AMOUNT,
			TRIM(TO_CHAR(NVL(i.CURBILL, i.CURTXN))) AS CURRENCY,
			TRIM(i.DESCRIPTION) AS DESCRIPTION,
			TO_CHAR(i.TXNCODE) AS TXN_CODE,
			TO_CHAR(i.CTXDATE, 'YYYY-MM-DD') AS TXN_DATE,
			CASE
				WHEN i.TIMELOCAL IS NULL THEN ''
				ELSE SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 1, 2)
					|| ':' || SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 3, 2)
					|| ':' || SUBSTR(LPAD(TO_CHAR(i.TIMELOCAL), 6, '0'), 5, 2)
			END AS TXN_TIME,
			i.TLOGID AS TLOG_ID,
			i.ID AS ACC_ITEM_ID
		FROM cortex.accitems i
		JOIN cortex.crddet c
			ON c.ID = i.CRDDET_ID
			AND c.CRDPRODUCT_ID IN (%s)
		LEFT JOIN cortex.crdproduct p ON p.ID = c.CRDPRODUCT_ID
		LEFT JOIN cortex.crdstatus s ON TRIM(c.STATCODE) = TRIM(s.STATCODE)
		LEFT JOIN cortex.branch b ON b.ID = c.BRANCH_ID
		LEFT JOIN cortex.crdacc ca ON ca.CRDDET_ID = c.ID
		LEFT JOIN cortex.accdet a ON a.ID = ca.ACCDET_ID
		%s
		WHERE `+prepaidVisaUnloadPredI+`
			AND NVL(i.REV, 0) = 0
			%s
			%s
			%s
		ORDER BY i.CTXDATE DESC, i.ID DESC
		OFFSET :offset ROWS
		FETCH NEXT :fetch_limit ROWS ONLY
	`,
		fmt.Sprintf(prepaidVisaCardSelect, cardholder),
		ids,
		prepaidVisaAmtJoin,
		dateSQL,
		commonSQL,
		extraSQL,
	)

	queryArgs := append([]any{}, dateArgs...)
	queryArgs = append(queryArgs, commonArgs...)
	queryArgs = append(queryArgs, extraArgs...)
	queryArgs = append(queryArgs,
		sql.Named("offset", offset),
		sql.Named("fetch_limit", fetchLimit),
	)
	rows, err := r.db.QueryContext(ctx, q, queryArgs...)
	if err != nil {
		return nil, false, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	results, err := scanPrepaidVisaUnloads(rows)
	if err != nil {
		return nil, false, err
	}
	pageRows, hasMore := trimPrepaidVisaPage(results, pageSize)
	return pageRows, hasMore, nil
}

func (r *prepaidVisaRepository) searchTransactions(
	ctx context.Context,
	req model.PrepaidVisaSearchRequest,
	includeCardholder bool,
	page, pageSize int,
) ([]model.PrepaidVisaTransaction, bool, error) {
	cardholder := prepaidVisaCardholderNull
	if includeCardholder {
		cardholder = prepaidVisaCardholderPermitted
	}
	offset := (page - 1) * pageSize
	fetchLimit := pageSize + 1

	dateSQL, dateArgs := prepaidVisaLedgerDateClause("t", req.DateFrom, req.DateTo)
	commonSQL, commonArgs := prepaidVisaSearchCommonClause(req, includeCardholder, prepaidVisaTxnSearchQCols(includeCardholder))
	extraSQL, extraArgs := prepaidVisaTxnExtraSearchClause(req)

	q := fmt.Sprintf(`
		SELECT
			%s,
			%s AS AMOUNT,
			TRIM(TO_CHAR(t.CURBILL)) AS CURRENCY,
			%s AS AMOUNT_TXN,
			TRIM(TO_CHAR(t.CURTXN)) AS TXN_CURRENCY,
			TO_CHAR(t.TXNCODE) AS TXN_CODE,
			TRIM(TO_CHAR(t.MSGCLS)) AS MSG_TYPE,
			TRIM(t.RSPCODE) AS RSP_CODE,
			TRIM(t.RRN) AS RRN,
			TRIM(t.TERMCODE) AS TERMINAL_ID,
			TRIM(t.CRDACPTLOC) AS MERCHANT_NAME,
			TRIM(t.CRDACPTID) AS MERCHANT_ID,
			TO_CHAR(t.CTXDATE, 'YYYY-MM-DD') AS TXN_DATE,
			CASE
				WHEN t.TIMELOCAL IS NULL THEN ''
				ELSE SUBSTR(LPAD(TO_CHAR(t.TIMELOCAL), 6, '0'), 1, 2)
					|| ':' || SUBSTR(LPAD(TO_CHAR(t.TIMELOCAL), 6, '0'), 3, 2)
					|| ':' || SUBSTR(LPAD(TO_CHAR(t.TIMELOCAL), 6, '0'), 5, 2)
			END AS TXN_TIME,
			t.ID AS TLOG_ID
		FROM cortex.tlog t
		JOIN cortex.crddet c ON c.ID = t.CRDDET_ID
		LEFT JOIN cortex.crdproduct p ON p.ID = c.CRDPRODUCT_ID
		LEFT JOIN cortex.crdstatus s ON TRIM(c.STATCODE) = TRIM(s.STATCODE)
		LEFT JOIN cortex.branch b ON b.ID = c.BRANCH_ID
		LEFT JOIN cortex.crdacc ca ON ca.CRDDET_ID = c.ID
		LEFT JOIN cortex.accdet a ON a.ID = ca.ACCDET_ID
		%s
		WHERE 1=1
			%s
			%s
			%s
			%s
		ORDER BY t.CTXDATE DESC, t.ID DESC
		OFFSET :offset ROWS
		FETCH NEXT :fetch_limit ROWS ONLY
	`,
		fmt.Sprintf(prepaidVisaCardSelect, cardholder),
		prepaidVisaSignedAmtBill,
		prepaidVisaSignedAmtTxn,
		prepaidVisaAmtJoin,
		dateSQL,
		prepaidVisaTlogProductPred(req.Product),
		commonSQL,
		extraSQL,
	)

	queryArgs := append([]any{}, dateArgs...)
	queryArgs = append(queryArgs, commonArgs...)
	queryArgs = append(queryArgs, extraArgs...)
	queryArgs = append(queryArgs,
		sql.Named("offset", offset),
		sql.Named("fetch_limit", fetchLimit),
	)
	rows, err := r.db.QueryContext(ctx, q, queryArgs...)
	if err != nil {
		return nil, false, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	results, err := scanPrepaidVisaTransactions(rows)
	if err != nil {
		return nil, false, err
	}
	pageRows, hasMore := trimPrepaidVisaPage(results, pageSize)
	return pageRows, hasMore, nil
}

func scanPrepaidVisaTopUps(rows *sql.Rows) ([]model.PrepaidVisaTopUp, error) {
	results := make([]model.PrepaidVisaTopUp, 0, 64)
	for rows.Next() {
		var (
			cardID                                         sql.NullInt64
			cardMasked, holder, productCode, productName   sql.NullString
			statusCode, statusDesc, branchCode, branchName sql.NullString
			availBal, availAmt, blockedBal, fromAvailable, unloaded sql.NullFloat64
			acctCurr, customerID, acctNo                   sql.NullString
			amount                                         sql.NullFloat64
			currency, description, txnCode, date, time     sql.NullString
			tlogID, accItemID                              sql.NullInt64
		)
		if err := rows.Scan(
			&cardID, &cardMasked, &holder,
			&productCode, &productName,
			&statusCode, &statusDesc,
			&branchCode, &branchName,
			&availBal, &availAmt, &blockedBal, &fromAvailable, &unloaded, &acctCurr,
			&customerID, &acctNo,
			&amount, &currency, &description, &txnCode,
			&date, &time, &tlogID, &accItemID,
		); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}
		row := model.PrepaidVisaTopUp{
			CardID:            cardID.Int64,
			CardMasked:        cardMasked.String,
			CustomerID:        customerID.String,
			CardholderName:    holder.String,
			ProductCode:       productCode.String,
			ProductName:       productName.String,
			StatusCode:        statusCode.String,
			StatusDescription: statusDesc.String,
			BranchCode:        branchCode.String,
			BranchName:        branchName.String,
			AvailableBalance:  availBal.Float64,
			AvailableAmount:   availAmt.Float64,
			BlockedBalance:    blockedBal.Float64,
			FromAvailable:     fromAvailable.Float64,
			AccountCurrency:   acctCurr.String,
			AccountNumber:     acctNo.String,
			Amount:            amount.Float64,
			Currency:          currency.String,
			Description:       description.String,
			TxnCode:           txnCode.String,
			Date:              date.String,
			Time:              time.String,
			AccItemID:         accItemID.Int64,
		}
		if tlogID.Valid {
			v := tlogID.Int64
			row.TlogID = &v
		}
		results = append(results, row)
	}
	if err := rows.Err(); err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	return results, nil
}

func scanPrepaidVisaUnloads(rows *sql.Rows) ([]model.PrepaidVisaUnload, error) {
	results := make([]model.PrepaidVisaUnload, 0, 64)
	for rows.Next() {
		var (
			cardID                                         sql.NullInt64
			cardMasked, holder, productCode, productName   sql.NullString
			statusCode, statusDesc, branchCode, branchName sql.NullString
			availBal, availAmt, blockedBal, fromAvailable, unloaded sql.NullFloat64
			acctCurr, acctNo                               sql.NullString
			amount                                         sql.NullFloat64
			currency, description, txnCode, date, time     sql.NullString
			tlogID, accItemID                              sql.NullInt64
		)
		if err := rows.Scan(
			&cardID, &cardMasked, &holder,
			&productCode, &productName,
			&statusCode, &statusDesc,
			&branchCode, &branchName,
			&availBal, &availAmt, &blockedBal, &fromAvailable, &unloaded, &acctCurr, &acctNo,
			&amount, &currency, &description, &txnCode,
			&date, &time, &tlogID, &accItemID,
		); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}
		descText := strings.TrimSpace(description.String)
		if descText == "" {
			descText = "Account unload"
		}
		row := model.PrepaidVisaUnload{
			CardID:            cardID.Int64,
			CardMasked:        cardMasked.String,
			CardholderName:    holder.String,
			ProductCode:       productCode.String,
			ProductName:       productName.String,
			StatusCode:        statusCode.String,
			StatusDescription: statusDesc.String,
			BranchCode:        branchCode.String,
			BranchName:        branchName.String,
			AvailableBalance:  availBal.Float64,
			AvailableAmount:   availAmt.Float64,
			BlockedBalance:    blockedBal.Float64,
			FromAvailable:     fromAvailable.Float64,
			Unloaded:          unloaded.Float64,
			AccountCurrency:   acctCurr.String,
			AccountNumber:     acctNo.String,
			Amount:            amount.Float64,
			Currency:          currency.String,
			Description:       descText,
			TxnCode:           txnCode.String,
			Date:              date.String,
			Time:              time.String,
			AccItemID:         accItemID.Int64,
		}
		if tlogID.Valid {
			v := tlogID.Int64
			row.TlogID = &v
		}
		results = append(results, row)
	}
	if err := rows.Err(); err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	return results, nil
}

func scanPrepaidVisaTransactions(rows *sql.Rows) ([]model.PrepaidVisaTransaction, error) {
	results := make([]model.PrepaidVisaTransaction, 0, 64)
	for rows.Next() {
		var (
			cardID                                         sql.NullInt64
			cardMasked, holder, productCode, productName   sql.NullString
			statusCode, statusDesc, branchCode, branchName sql.NullString
			availBal, availAmt, blockedBal, fromAvailable, unloaded sql.NullFloat64
			acctCurr                                       sql.NullString
			amount, amountTxn                              sql.NullFloat64
			currency, txnCurrency                          sql.NullString
			txnCode, msgType, rspCode                      sql.NullString
			rrn, termID, merchant, merchantID              sql.NullString
			date, time                                     sql.NullString
			tlogID                                         sql.NullInt64
		)
		if err := rows.Scan(
			&cardID, &cardMasked, &holder,
			&productCode, &productName,
			&statusCode, &statusDesc,
			&branchCode, &branchName,
			&availBal, &availAmt, &blockedBal, &fromAvailable, &unloaded, &acctCurr,
			&amount, &currency, &amountTxn, &txnCurrency,
			&txnCode, &msgType, &rspCode,
			&rrn, &termID, &merchant, &merchantID,
			&date, &time, &tlogID,
		); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}
		results = append(results, model.PrepaidVisaTransaction{
			CardID:            cardID.Int64,
			CardMasked:        cardMasked.String,
			CardholderName:    holder.String,
			ProductCode:       productCode.String,
			ProductName:       productName.String,
			StatusCode:        statusCode.String,
			StatusDescription: statusDesc.String,
			BranchCode:        branchCode.String,
			BranchName:        branchName.String,
			AvailableBalance:  availBal.Float64,
			AvailableAmount:   availAmt.Float64,
			BlockedBalance:    blockedBal.Float64,
			FromAvailable:     fromAvailable.Float64,
			AccountCurrency:   acctCurr.String,
			Amount:            amount.Float64,
			Currency:          currency.String,
			AmountTxn:         amountTxn.Float64,
			TxnCurrency:       txnCurrency.String,
			TxnCode:           txnCode.String,
			MsgType:           msgType.String,
			RspCode:           rspCode.String,
			Approved:          rspCode.String == "00",
			RRN:               rrn.String,
			TerminalID:        termID.String,
			MerchantName:      merchant.String,
			MerchantID:        merchantID.String,
			Date:              date.String,
			Time:              time.String,
			TlogID:            tlogID.Int64,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	return results, nil
}

