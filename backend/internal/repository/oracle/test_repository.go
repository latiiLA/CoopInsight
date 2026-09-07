package oracle

import (
	"context"
	"database/sql"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

type testRepository struct {
	db *sql.DB
}

func NewTestRepository(db *sql.DB) repository.TestRepository {
	return &testRepository{
		db: db,
	}
}

func (r *testRepository) GetTestData(ctx context.Context, dateFrom, dateTo string, page, pageSize int) ([]map[string]interface{}, error) {
	query := `
		SELECT
			td.district AS DISTRICT,
			'ET00' || br.brncode AS "BRANCH_CODE",
			td.Branch_Name,
			TL.TERMCODE AS "TERMINAL_ID",
			TL.CRDACPTLOC AS "TERMINAL_NAME",
			COUNT(TL.RRN) AS "NUMBER_TRNX",
			SUM(TL.AMTTXN) AS "TOTAL_AMT"
		FROM CORTEX.TLOG TL,
			CORTEX.BRANCH BR,
			CORTEX.TERMINAL_DETAILS td
		WHERE tl.termcode = td.terminal_id
			AND TL.TXNCODE = 21
			AND TL.RSPCODE = '00'
			AND TL.TXNSTATUS IN (7, 11)
			AND TRIM(TL.AIID) IN ('9231410', '231447')
			AND SUBSTR(TL.termcode, -3) = SUBSTR(BR.brncode, -3)
			AND TL.datelocal BETWEEN
				TO_DATE(:date_from, 'MM-DD-YYYY')
				AND TO_DATE(:date_to, 'MM-DD-YYYY')
		GROUP BY
			td.district,
			td.Branch_Name,
			TL.TERMCODE,
			TL.CRDACPTLOC,
			'ET00' || BR.brncode,
			BR.descr
		ORDER BY 1
	`

	args := []interface{}{
		sql.Named("date_from", dateFrom),
		sql.Named("date_to", dateTo),
	}

	// Apply pagination only when both values are provided.
	if page > 0 && pageSize > 0 {
		offset := (page - 1) * pageSize

		query += `
			OFFSET :offset ROWS
			FETCH NEXT :page_size ROWS ONLY
		`

		args = append(
			args,
			sql.Named("offset", offset),
			sql.Named("page_size", pageSize),
		)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	defer func() { _ = rows.Close() }()

	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	results := make([]map[string]interface{}, 0)

	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePointers := make([]interface{}, len(columns))

		for i := range values {
			valuePointers[i] = &values[i]
		}

		if err := rows.Scan(valuePointers...); err != nil {
			return nil, err
		}

		row := make(map[string]interface{})

		for i, column := range columns {
			row[column] = values[i]
		}

		results = append(results, row)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return results, nil
}
