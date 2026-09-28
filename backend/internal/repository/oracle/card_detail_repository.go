package oracle

import (
	"context"
	"fmt"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

const (
	cardDetailDefaultPageSize = 200
	cardDetailMaxPageSize     = 1000
)

// cardDetailJoin is shared by every metric. Issued and activated dates live on
// CRDDET_X, so the join is unconditional; a LEFT JOIN keeps created-metric rows
// that have no CRDDET_X row yet.
const cardDetailJoin = `
	FROM cortex.crddet c
	LEFT JOIN cortex.crddet_x x ON c.ID = x.CRDDET_ID
	LEFT JOIN cortex.crdstatus s ON TRIM(c.STATCODE) = TRIM(s.STATCODE)
	LEFT JOIN cortex.crdproduct p ON p.ID = c.CRDPRODUCT_ID
	LEFT JOIN cortex.branch b ON b.ID = c.BRANCH_ID
`

// cardDetailCardholderColumn is selected only for callers holding the
// cardholder-name permission, so the value never reaches a response the caller
// is not entitled to see. The placeholder keeps the scan arity stable.
const cardDetailCardholderColumn = `		CAST(NULL AS VARCHAR2(1)) AS CARDHOLDER_NAME,`

// cardDetailPermittedCardholderColumn selects the given name only.
//
// FIRSTNAME holds the cardholder's own name and LASTNAME holds the same string
// again, so concatenating the two columns printed every name twice
// ("MOTUMA EJERSA MOTUMA EJERSA"). The first name column is used on its own
// for that reason, and no surname is projected.
//
// L10N_FIRSTNAME is preferred where populated because it carries the localised
// spelling, which matters for the Amharic names. It is present on only 7 of
// 486,438 cards, so FIRSTNAME is the fallback and by far the common case.
// L10N_LASTNAME is a patronymic rather than a surname the holder would
// recognise, so it is deliberately left out.
const cardDetailPermittedCardholderColumn = `		NVL(
			NULLIF(TRIM(c.L10N_FIRSTNAME), ''),
			NULLIF(TRIM(c.FIRSTNAME), '')
		) AS CARDHOLDER_NAME,`

// ListCardDetails pages through the individual cards behind an activity count.
//
// Each metric is measured on a different date column, so both the filter and
// the sort key vary by metric; everything else is shared.
//
// Three deliberate constraints on the projection:
//
//   - The card number is masked here in SQL with SUBSTR, so an unmasked PAN
//     never leaves the database. PAN_DISPLAY holds an 11-character form, so
//     first six plus last four stays unambiguous without reprinting the middle.
//   - PCI columns (CVV, CVC, PVV, PVKI, PINSMADE) and DATE_BIRTH are never
//     selected and must never be added; PCI-DSS forbids storing or logging them.
//   - Dates are rendered with TO_CHAR because the driver returns a +03:00
//     session offset that can shift the calendar day once Go marshals it.
//
// The second return value reports whether rows exist beyond this page.
func (r *cardRepository) ListCardDetails(
	ctx context.Context,
	metric string,
	dateFrom time.Time,
	dateTo time.Time,
	branchID *int64,
	page int,
	pageSize int,
	includeCardholder bool,
) ([]model.CardDetail, bool, error) {
	page, pageSize = normalizeCardDetailPage(page, pageSize)
	offset := (page - 1) * pageSize
	// Fetch one extra row to learn hasMore without paying for a COUNT query.
	fetchLimit := pageSize + 1

	// Every bind name is used exactly once, matching the style of the other
	// Oracle repositories in this package.
	args := make([]any, 0, 5)
	args = append(args, oracleDate(dateFrom), oracleDate(dateTo))

	branchCondition := ""
	if branchID != nil {
		branchCondition = "\n\t\tAND c.BRANCH_ID = :branch_id"
		args = append(args, *branchID)
	}

	offsetIndex := len(args) + 1
	fetchIndex := len(args) + 2
	args = append(args, offset, fetchLimit)

	query, err := buildCardDetailQuery(
		metric,
		includeCardholder,
		branchCondition,
		offsetIndex,
		fetchIndex,
	)
	if err != nil {
		return nil, false, err
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, false, err
	}
	defer func() { _ = rows.Close() }()

	items := make([]model.CardDetail, 0, pageSize)

	for rows.Next() {
		var detail model.CardDetail

		if err := rows.Scan(
			&detail.CardID,
			&detail.CardMasked,
			&detail.CardholderName,
			&detail.SeqNo,
			&detail.ProductCode,
			&detail.ProductName,
			&detail.StatusCode,
			&detail.StatusDescription,
			&detail.BranchCode,
			&detail.BranchName,
			&detail.EffectiveDate,
			&detail.ExpiryDate,
			&detail.CreatedAt,
			&detail.IssuedAt,
			&detail.ActivatedAt,
		); err != nil {
			return nil, false, err
		}

		items = append(items, detail)
	}

	if err := rows.Err(); err != nil {
		return nil, false, err
	}

	// The extra row was a probe, not data.
	hasMore := false
	if len(items) > pageSize {
		items = items[:pageSize]
		hasMore = true
	}

	return items, hasMore, nil
}

// buildCardDetailQuery renders the paged detail query. It is separate from
// ListCardDetails so the SQL can be asserted in tests without a live database.
func buildCardDetailQuery(
	metric string,
	includeCardholder bool,
	branchCondition string,
	offsetIndex int,
	fetchIndex int,
) (string, error) {
	activityColumn, err := cardDetailActivityColumn(metric)
	if err != nil {
		return "", err
	}

	cardholderColumn := cardDetailCardholderColumn
	if includeCardholder {
		cardholderColumn = cardDetailPermittedCardholderColumn
	}

	return fmt.Sprintf(`
		SELECT
			c.ID AS CARD_ID,
			SUBSTR(c.PAN_DISPLAY, 1, 6) || 'XXXXXX' || SUBSTR(c.PAN_DISPLAY, -4) AS CARD_MASKED,
			%s
			c.SEQNO AS SEQ_NO,
			TRIM(p.CRDPRODUCT) AS PRODUCT_CODE,
			TRIM(p.DESCR) AS PRODUCT_NAME,
			TRIM(c.STATCODE) AS STATUS_CODE,
			TRIM(s.DESCR) AS STATUS_DESCRIPTION,
			TRIM(b.BRNCODE) AS BRANCH_CODE,
			TRIM(b.DESCR) AS BRANCH_NAME,
			TO_CHAR(c.EFFDATE, 'YYYY-MM-DD') AS EFFECTIVE_DATE,
			TO_CHAR(c.EXPDATE, 'YYYY-MM-DD') AS EXPIRY_DATE,
			TO_CHAR(c.DATE_CREATED, 'YYYY-MM-DD') AS CREATED_AT,
			TO_CHAR(x.DATELSTISSUED, 'YYYY-MM-DD') AS ISSUED_AT,
			TO_CHAR(x.DATE_ACTIVATION, 'YYYY-MM-DD') AS ACTIVATED_AT
		%s
		WHERE %s >= TO_DATE(:1, 'MM-DD-YYYY')
			AND %s < TO_DATE(:2, 'MM-DD-YYYY') + 1%s
		-- Stable order is required for OFFSET/FETCH to page without skipping or
		-- repeating rows; ID breaks ties on cards sharing an activity timestamp.
		ORDER BY %s DESC, c.ID DESC
		OFFSET :%d ROWS
		FETCH NEXT :%d ROWS ONLY
	`,
		cardholderColumn,
		cardDetailJoin,
		activityColumn,
		activityColumn,
		branchCondition,
		activityColumn,
		offsetIndex,
		fetchIndex,
	), nil
}

// cardDetailActivityColumn maps a metric to the date column it is measured on.
// Created is stored on CRDDET; issued and activated are on CRDDET_X.
func cardDetailActivityColumn(metric string) (string, error) {
	switch metric {
	case model.CardMetricCreated:
		return "c.DATE_CREATED", nil
	case model.CardMetricIssued:
		return "x.DATELSTISSUED", nil
	case model.CardMetricActivated:
		return "x.DATE_ACTIVATION", nil
	default:
		return "", fmt.Errorf("unsupported card metric %q", metric)
	}
}

func normalizeCardDetailPage(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = cardDetailDefaultPageSize
	}
	if pageSize > cardDetailMaxPageSize {
		pageSize = cardDetailMaxPageSize
	}
	return page, pageSize
}
