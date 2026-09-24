package oracle

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

type cardRepository struct {
	db *sql.DB
}

func NewCardRepository(db *sql.DB) repository.CardRepository {
	return &cardRepository{
		db: db,
	}
}

// oracleDate formats a calendar day as MM-DD-YYYY for TO_DATE binds.
// Using strings (not time.Time) avoids driver timezone shifts that can
// drop an entire single-day window or mis-key TRUNC() results.
func oracleDate(t time.Time) string {
	return fmt.Sprintf("%02d-%02d-%04d", int(t.Month()), t.Day(), t.Year())
}

func (r *cardRepository) CountCardPerStatus(
	ctx context.Context,
	dateFrom *time.Time,
	dateTo *time.Time,
) ([]model.Card, error) {
	query := `
		SELECT
			c.STATCODE AS CARD_STATUS,
			s.DESCR AS STATUS_DESCRIPTION,
			COUNT(*) AS CARD_COUNT
		FROM cortex.crddet c
		LEFT JOIN cortex.crdstatus s
			ON TRIM(c.STATCODE) = TRIM(s.STATCODE)
	`

	args := make([]any, 0, 2)
	conditions := make([]string, 0, 2)

	if dateFrom != nil {
		conditions = append(conditions, "c.DATE_CREATED >= TO_DATE(:1, 'MM-DD-YYYY')")
		args = append(args, oracleDate(*dateFrom))
	}

	if dateTo != nil {
		conditions = append(conditions, "c.DATE_CREATED < TO_DATE(:2, 'MM-DD-YYYY') + 1")
		args = append(args, oracleDate(*dateTo))
	}

	if len(conditions) > 0 {
		query += "\nWHERE " + strings.Join(conditions, "\n  AND ")
	}

	query += `
		GROUP BY
			c.STATCODE,
			s.DESCR
		ORDER BY
			c.STATCODE
	`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cards []model.Card

	for rows.Next() {
		var card model.Card

		if err := rows.Scan(
			&card.CardStatus,
			&card.StatusDescription,
			&card.CardCount,
		); err != nil {
			return nil, err
		}

		cards = append(cards, card)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return cards, nil
}

// CardActivity returns per-day counts of cards created, issued, and activated
// within [dateFrom, dateTo]. Created comes from CRDDET.DATE_CREATED, while
// issued and activated come from CRDDET_X.DATELSTISSUED and
// CRDDET_X.DATE_ACTIVATION respectively. Only days that have at least one
// event are returned; the service layer fills the gaps.
func (r *cardRepository) CardActivity(
	ctx context.Context,
	dateFrom time.Time,
	dateTo time.Time,
) ([]model.CardDailyActivity, error) {
	from := oracleDate(dateFrom)
	to := oracleDate(dateTo)

	query := `
		SELECT TO_CHAR(TRUNC(c.DATE_CREATED), 'YYYY-MM-DD') AS DAY, 'created' AS METRIC, COUNT(*) AS CNT
		FROM cortex.crddet c
		WHERE c.DATE_CREATED >= TO_DATE(:1, 'MM-DD-YYYY')
		  AND c.DATE_CREATED < TO_DATE(:2, 'MM-DD-YYYY') + 1
		GROUP BY TRUNC(c.DATE_CREATED)
		UNION ALL
		SELECT TO_CHAR(TRUNC(x.DATELSTISSUED), 'YYYY-MM-DD'), 'issued', COUNT(*)
		FROM cortex.crddet_x x
		WHERE x.DATELSTISSUED >= TO_DATE(:3, 'MM-DD-YYYY')
		  AND x.DATELSTISSUED < TO_DATE(:4, 'MM-DD-YYYY') + 1
		GROUP BY TRUNC(x.DATELSTISSUED)
		UNION ALL
		SELECT TO_CHAR(TRUNC(x.DATE_ACTIVATION), 'YYYY-MM-DD'), 'activated', COUNT(*)
		FROM cortex.crddet_x x
		WHERE x.DATE_ACTIVATION >= TO_DATE(:5, 'MM-DD-YYYY')
		  AND x.DATE_ACTIVATION < TO_DATE(:6, 'MM-DD-YYYY') + 1
		GROUP BY TRUNC(x.DATE_ACTIVATION)
	`

	args := []any{from, to, from, to, from, to}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byDay := make(map[string]*model.CardDailyActivity)

	for rows.Next() {
		var (
			day    string
			metric string
			count  int64
		)

		if err := rows.Scan(&day, &metric, &count); err != nil {
			return nil, err
		}

		entry := byDay[day]
		if entry == nil {
			entry = &model.CardDailyActivity{Date: day}
			byDay[day] = entry
		}

		switch metric {
		case "created":
			entry.Created = count
		case "issued":
			entry.Issued = count
		case "activated":
			entry.Activated = count
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	result := make([]model.CardDailyActivity, 0, len(byDay))
	for _, entry := range byDay {
		result = append(result, *entry)
	}

	return result, nil
}

// CardActivityByBranch returns created/issued/activated totals grouped by
// branch for [dateFrom, dateTo]. Issued and activated live on CRDDET_X, so
// they are attributed to a branch through CRDDET_X -> CRDDET -> BRANCH.
func (r *cardRepository) CardActivityByBranch(
	ctx context.Context,
	dateFrom time.Time,
	dateTo time.Time,
) ([]model.CardBranchActivity, error) {
	from := oracleDate(dateFrom)
	to := oracleDate(dateTo)

	query := `
		SELECT b.ID AS BRANCH_ID, b.BRNCODE AS BRANCH_CODE, b.DESCR AS BRANCH_NAME,
		       'created' AS METRIC, COUNT(*) AS CNT
		FROM cortex.crddet c
		JOIN cortex.branch b ON b.ID = c.BRANCH_ID
		WHERE c.DATE_CREATED >= TO_DATE(:1, 'MM-DD-YYYY')
		  AND c.DATE_CREATED < TO_DATE(:2, 'MM-DD-YYYY') + 1
		GROUP BY b.ID, b.BRNCODE, b.DESCR
		UNION ALL
		SELECT b.ID, b.BRNCODE, b.DESCR, 'issued', COUNT(*)
		FROM cortex.crddet_x x
		JOIN cortex.crddet c ON c.ID = x.CRDDET_ID
		JOIN cortex.branch b ON b.ID = c.BRANCH_ID
		WHERE x.DATELSTISSUED >= TO_DATE(:3, 'MM-DD-YYYY')
		  AND x.DATELSTISSUED < TO_DATE(:4, 'MM-DD-YYYY') + 1
		GROUP BY b.ID, b.BRNCODE, b.DESCR
		UNION ALL
		SELECT b.ID, b.BRNCODE, b.DESCR, 'activated', COUNT(*)
		FROM cortex.crddet_x x
		JOIN cortex.crddet c ON c.ID = x.CRDDET_ID
		JOIN cortex.branch b ON b.ID = c.BRANCH_ID
		WHERE x.DATE_ACTIVATION >= TO_DATE(:5, 'MM-DD-YYYY')
		  AND x.DATE_ACTIVATION < TO_DATE(:6, 'MM-DD-YYYY') + 1
		GROUP BY b.ID, b.BRNCODE, b.DESCR
	`

	args := []any{from, to, from, to, from, to}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byBranch := make(map[int64]*model.CardBranchActivity)

	for rows.Next() {
		var (
			branchID   int64
			branchCode string
			branchName string
			metric     string
			count      int64
		)

		if err := rows.Scan(&branchID, &branchCode, &branchName, &metric, &count); err != nil {
			return nil, err
		}

		entry := byBranch[branchID]
		if entry == nil {
			entry = &model.CardBranchActivity{
				BranchID:   branchID,
				BranchCode: branchCode,
				BranchName: branchName,
			}
			byBranch[branchID] = entry
		}

		switch metric {
		case "created":
			entry.Created = count
		case "issued":
			entry.Issued = count
		case "activated":
			entry.Activated = count
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	result := make([]model.CardBranchActivity, 0, len(byBranch))
	for _, entry := range byBranch {
		result = append(result, *entry)
	}

	return result, nil
}

// CardActivityForBranch returns the per-day created/issued/activated series for
// a single branch within [dateFrom, dateTo]. Only days with activity are
// returned; the service layer fills the gaps.
func (r *cardRepository) CardActivityForBranch(
	ctx context.Context,
	branchID int64,
	dateFrom time.Time,
	dateTo time.Time,
) ([]model.CardDailyActivity, error) {
	from := oracleDate(dateFrom)
	to := oracleDate(dateTo)

	query := `
		SELECT TO_CHAR(TRUNC(c.DATE_CREATED), 'YYYY-MM-DD') AS DAY, 'created' AS METRIC, COUNT(*) AS CNT
		FROM cortex.crddet c
		WHERE c.BRANCH_ID = :1
		  AND c.DATE_CREATED >= TO_DATE(:2, 'MM-DD-YYYY')
		  AND c.DATE_CREATED < TO_DATE(:3, 'MM-DD-YYYY') + 1
		GROUP BY TRUNC(c.DATE_CREATED)
		UNION ALL
		SELECT TO_CHAR(TRUNC(x.DATELSTISSUED), 'YYYY-MM-DD'), 'issued', COUNT(*)
		FROM cortex.crddet_x x
		JOIN cortex.crddet c ON c.ID = x.CRDDET_ID
		WHERE c.BRANCH_ID = :4
		  AND x.DATELSTISSUED >= TO_DATE(:5, 'MM-DD-YYYY')
		  AND x.DATELSTISSUED < TO_DATE(:6, 'MM-DD-YYYY') + 1
		GROUP BY TRUNC(x.DATELSTISSUED)
		UNION ALL
		SELECT TO_CHAR(TRUNC(x.DATE_ACTIVATION), 'YYYY-MM-DD'), 'activated', COUNT(*)
		FROM cortex.crddet_x x
		JOIN cortex.crddet c ON c.ID = x.CRDDET_ID
		WHERE c.BRANCH_ID = :7
		  AND x.DATE_ACTIVATION >= TO_DATE(:8, 'MM-DD-YYYY')
		  AND x.DATE_ACTIVATION < TO_DATE(:9, 'MM-DD-YYYY') + 1
		GROUP BY TRUNC(x.DATE_ACTIVATION)
	`

	args := []any{
		branchID, from, to,
		branchID, from, to,
		branchID, from, to,
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byDay := make(map[string]*model.CardDailyActivity)

	for rows.Next() {
		var (
			day    string
			metric string
			count  int64
		)

		if err := rows.Scan(&day, &metric, &count); err != nil {
			return nil, err
		}

		entry := byDay[day]
		if entry == nil {
			entry = &model.CardDailyActivity{Date: day}
			byDay[day] = entry
		}

		switch metric {
		case "created":
			entry.Created = count
		case "issued":
			entry.Issued = count
		case "activated":
			entry.Activated = count
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	result := make([]model.CardDailyActivity, 0, len(byDay))
	for _, entry := range byDay {
		result = append(result, *entry)
	}

	return result, nil
}
