package oracle

import (
	"context"
	"fmt"
	"strings"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

// statusDimensions says which columns a grouping is built from. The SELECT and
// GROUP BY lists are derived from this rather than from a raw string, so a
// caller-supplied groupBy can never reach the SQL as free text.
type statusDimensions struct {
	byStatus  bool
	byProduct bool
	byBranch  bool
}

var statusGroupings = map[string]statusDimensions{
	"status":         {byStatus: true},
	"product":        {byProduct: true},
	"branch":         {byBranch: true},
	"status-product": {byStatus: true, byProduct: true},
	"status-branch":  {byStatus: true, byBranch: true},
}

// statusDateFields maps the dateField option to the column it applies to.
//
// "created" is when the card was requested; "statusChanged" is DATE_STATCHG,
// when the card entered its current status. The distinction matters: filtering
// on DATE_CREATED gives a cohort requested in the window and where those cards
// sit now, whereas DATE_STATCHG gives status movement during the window.
var statusDateFields = map[string]string{
	"created":       "c.DATE_CREATED",
	"statusChanged": "c.DATE_STATCHG",
}

// nullDim keeps the SELECT list the same shape for every grouping, so the scan
// below is a fixed list rather than one rebuilt to match the grouping. A
// dimension that is not being grouped by reads as NULL instead of an arbitrary
// value from the group.
const nullDim = "CAST(NULL AS VARCHAR2(20))"

// The status dimension carries the vendor's own flags alongside the code and
// description, so the report can show CRDSTATUS's view next to the derived
// health band.
var (
	statusSelects  = []string{"TRIM(c.STATCODE)", "TRIM(s.DESCR)", "TRIM(s.ACTIONCODE)", "TRIM(s.CANCELED)"}
	productSelects = []string{"TRIM(p.CRDPRODUCT)", "TRIM(p.DESCR)"}
	branchSelects  = []string{"TRIM(b.BRNCODE)", "TRIM(b.DESCR)"}
)

func (d statusDimensions) selects() []string {
	out := make([]string, 0, 8)
	if d.byStatus {
		out = append(out, statusSelects...)
	} else {
		out = append(out, nullDim, nullDim, nullDim, nullDim)
	}
	if d.byProduct {
		out = append(out, productSelects...)
	} else {
		out = append(out, nullDim, nullDim)
	}
	if d.byBranch {
		out = append(out, branchSelects...)
	} else {
		out = append(out, nullDim, nullDim)
	}
	return out
}

func (d statusDimensions) groupBy() string {
	cols := make([]string, 0, 8)
	if d.byStatus {
		cols = append(cols, statusSelects...)
	}
	if d.byProduct {
		cols = append(cols, productSelects...)
	}
	if d.byBranch {
		cols = append(cols, branchSelects...)
	}
	return strings.Join(cols, ", ")
}

// ageBucket counts cards whose bucket date falls in a half-open range measured
// in days before today.
//
// lowerDaysAgo and upperDaysAgo are the range bounds, expressed as "at most N
// days ago" for the lower and "at least N days ago" for the upper:
//
//	lower=7,  upper=nil  ->  the last 7 days
//	lower=30, upper=7    ->  8 to 30 days ago
//	lower=nil, upper=90  ->  91 days ago and older
func ageBucket(dateColumn string, lowerDaysAgo, upperDaysAgo *int) string {
	clauses := make([]string, 0, 2)

	if lowerDaysAgo != nil {
		clauses = append(clauses, fmt.Sprintf(
			"%s >= TRUNC(SYSDATE) - %d", dateColumn, *lowerDaysAgo))
	}
	if upperDaysAgo != nil {
		clauses = append(clauses, fmt.Sprintf(
			"%s < TRUNC(SYSDATE) - %d", dateColumn, *upperDaysAgo))
	}

	// Two nils would mean unbounded on both sides, which would count every row.
	if len(clauses) == 0 {
		return "COUNT(*)"
	}

	return fmt.Sprintf("SUM(CASE WHEN %s THEN 1 ELSE 0 END)", strings.Join(clauses, " AND "))
}

// expiringExpression counts cards expiring within the given window. A window of
// zero or less disables the measure and returns a constant, so the column
// cannot be mistaken for a real count of zero.
func expiringExpression(withinMonths int) string {
	if withinMonths <= 0 {
		return "0"
	}
	return fmt.Sprintf(`SUM(CASE
			WHEN c.EXPDATE >= TRUNC(SYSDATE)
				AND c.EXPDATE < ADD_MONTHS(TRUNC(SYSDATE), %d)
			THEN 1 ELSE 0 END)`, withinMonths)
}

// CountCardPerStatus builds the cards-per-status report for the given filter.
func (r *cardRepository) CountCardPerStatus(
	ctx context.Context,
	filter repository.CardStatusFilter,
) ([]model.Card, error) {
	dimensions, ok := statusGroupings[filter.GroupBy]
	if !ok {
		return nil, fmt.Errorf("unsupported card groupBy %q", filter.GroupBy)
	}

	dateColumn, ok := statusDateFields[filter.DateField]
	if !ok {
		return nil, fmt.Errorf("unsupported card dateField %q", filter.DateField)
	}

	seven, thirty, ninety := 7, 30, 90

	columns := dimensions.selects()
	measures := []string{
		"COUNT(*)",
		ageBucket(dateColumn, &seven, nil),
		ageBucket(dateColumn, &thirty, &seven),
		ageBucket(dateColumn, &ninety, &thirty),
		ageBucket(dateColumn, nil, &ninety),
		expiringExpression(filter.ExpiringWithinMonths),
	}

	// Aliased in the order the scan below reads them.
	aliases := []string{
		"CARD_STATUS", "STATUS_DESCRIPTION", "ACTION_CODE", "CANCELED",
		"PRODUCT_CODE", "PRODUCT_NAME",
		"BRANCH_CODE", "BRANCH_NAME",
	}
	projection := make([]string, 0, len(columns)+len(measures))
	for i, col := range columns {
		projection = append(projection, fmt.Sprintf("%s AS %s", col, aliases[i]))
	}
	projection = append(projection, measures...)

	query := "\tSELECT\n\t\t" + strings.Join(projection, ",\n\t\t") +
		"\n\tFROM cortex.crddet c" +
		"\n\tLEFT JOIN cortex.crdstatus s ON TRIM(c.STATCODE) = TRIM(s.STATCODE)" +
		"\n\tLEFT JOIN cortex.crdproduct p ON p.ID = c.CRDPRODUCT_ID" +
		"\n\tLEFT JOIN cortex.branch b ON b.ID = c.BRANCH_ID"

	args := make([]any, 0, 4)
	conditions := make([]string, 0, 4)

	if filter.DateFrom != nil {
		args = append(args, oracleDate(*filter.DateFrom))
		conditions = append(conditions, fmt.Sprintf(
			"%s >= TO_DATE(:%d, 'MM-DD-YYYY')", dateColumn, len(args)))
	}
	if filter.DateTo != nil {
		args = append(args, oracleDate(*filter.DateTo))
		// The upper bound excludes the final day's later timestamps, so +1 makes
		// it inclusive of the whole day.
		conditions = append(conditions, fmt.Sprintf(
			"%s < TO_DATE(:%d, 'MM-DD-YYYY') + 1", dateColumn, len(args)))
	}
	if filter.ProductID != nil {
		args = append(args, *filter.ProductID)
		conditions = append(conditions, fmt.Sprintf("c.CRDPRODUCT_ID = :%d", len(args)))
	}
	if filter.BranchID != nil {
		args = append(args, *filter.BranchID)
		conditions = append(conditions, fmt.Sprintf("c.BRANCH_ID = :%d", len(args)))
	}

	if len(conditions) > 0 {
		query += "\n\tWHERE " + strings.Join(conditions, "\n\t  AND ")
	}

	query += "\n\tGROUP BY " + dimensions.groupBy()
	// Largest groups first so the most actionable rows lead the table.
	query += "\n\tORDER BY COUNT(*) DESC, " + dimensions.groupBy()

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	cards := make([]model.Card, 0, 32)

	for rows.Next() {
		var card model.Card

		if err := rows.Scan(
			&card.CardStatus,
			&card.StatusDescription,
			&card.ActionCode,
			&card.Canceled,
			&card.ProductCode,
			&card.ProductName,
			&card.BranchCode,
			&card.BranchName,
			&card.CardCount,
			&card.Age0To7,
			&card.Age8To30,
			&card.Age31To90,
			&card.Age91Plus,
			&card.ExpiringCount,
		); err != nil {
			return nil, err
		}

		// Derived here so the classification is unit-testable and the
		// repository stays a plain data source.
		card.Health = model.CardHealth(card.CardStatus)

		cards = append(cards, card)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return cards, nil
}
