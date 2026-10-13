package oracle

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

// Only the first 1100 bytes of RAW_MSG are needed to decode Type/PAN/Pcode/
// Amount/Trace (STAN @556, RRN/auth region ~1065+). Pulling the full ~5KB LOB per row causes multi-round-trip LOB
// reads and dominated the previous 15–55s list latency.
const safRawHeadBytes = 1100

// Advice Message monitoring is scoped to Cortex (IST SAFDB destination
// 1.1000000007 / Messages Forward for this route).
const safFocusDestination = "1.1000000007"

// Pending is always counted for the focus destination. Skipped (S) / Done (D)
// are restricted to the requested SAF_DATE range.
const safSummaryQuery = `
SELECT TRIM(STATUS) AS status, COUNT(*) AS cnt
FROM oasis.IST_SAFDB
WHERE DESTINATION = :dest
	AND (
		STATUS = 'P'
		OR (
			STATUS IN ('D', 'S')
			AND SAF_DATE >= TO_DATE(:date_from, 'YYYY-MM-DD')
			AND SAF_DATE < TO_DATE(:date_to, 'YYYY-MM-DD') + 1
		)
	)
GROUP BY TRIM(STATUS)
`

const safListQuery = `
SELECT
	SEQNUM,
	SAF_DATE,
	SEND_TIME,
	TRIM(STATUS),
	SITE_ID,
	CASE
		WHEN RAW_MSG IS NULL THEN NULL
		ELSE DBMS_LOB.SUBSTR(RAW_MSG, :raw_len, 1)
	END AS raw_head
FROM oasis.IST_SAFDB
WHERE DESTINATION = :dest
	AND STATUS = :status
	AND SAF_DATE >= TO_DATE(:date_from, 'YYYY-MM-DD')
	AND SAF_DATE < TO_DATE(:date_to, 'YYYY-MM-DD') + 1
ORDER BY SEND_TIME DESC NULLS LAST, SEQNUM DESC
FETCH FIRST :limit ROWS ONLY
`

type safRepository struct {
	db *sql.DB
}

func NewSafRepository(db *sql.DB) repository.SafRepository {
	return &safRepository{db: db}
}

func (r *safRepository) Summary(ctx context.Context, from, to time.Time) (*model.SafSummary, error) {
	fromKey := from.Format("2006-01-02")
	toKey := to.Format("2006-01-02")
	rows, err := r.db.QueryContext(
		ctx,
		safSummaryQuery,
		sql.Named("dest", safFocusDestination),
		sql.Named("date_from", fromKey),
		sql.Named("date_to", toKey),
	)
	if err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	summary := &model.SafSummary{
		DateFrom: fromKey,
		DateTo:   toKey,
		AsOf:     time.Now().UTC(),
	}
	for rows.Next() {
		var status sql.NullString
		var count sql.NullFloat64
		if err := rows.Scan(&status, &count); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}
		n := int(count.Float64)
		switch strings.ToUpper(strings.TrimSpace(status.String)) {
		case "P":
			summary.Pending = n
		case "D":
			summary.Done = n
		case "S":
			summary.Skipped = n
		default:
			summary.Other += n
		}
	}
	if err := rows.Err(); err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	return summary, nil
}

func (r *safRepository) ListByRange(
	ctx context.Context,
	from, to time.Time,
	status string,
	limit int,
) ([]model.SafTransaction, error) {
	fromKey := from.Format("2006-01-02")
	toKey := to.Format("2006-01-02")
	rows, err := r.db.QueryContext(
		ctx,
		safListQuery,
		sql.Named("raw_len", safRawHeadBytes),
		sql.Named("dest", safFocusDestination),
		sql.Named("status", status),
		sql.Named("date_from", fromKey),
		sql.Named("date_to", toKey),
		sql.Named("limit", limit),
	)
	if err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	out := make([]model.SafTransaction, 0)
	for rows.Next() {
		var (
			seqNum, statusVal sql.NullString
			sendTime, siteID  sql.NullInt64
			safDate           sql.NullTime
			rawHead           []byte
		)
		if err := rows.Scan(
			&seqNum,
			&safDate,
			&sendTime,
			&statusVal,
			&siteID,
			&rawHead,
		); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}

		row := model.SafTransaction{
			SeqNum: strings.TrimSpace(seqNum.String),
			Status: strings.ToUpper(strings.TrimSpace(statusVal.String)),
		}
		if safDate.Valid {
			v := safDate.Time
			row.SafDate = &v
		}
		if sendTime.Valid {
			v := sendTime.Int64
			row.SendTime = &v
		}
		if siteID.Valid {
			v := siteID.Int64
			row.SiteID = &v
		}

		decoded := decodeSafRawMsg(rawHead)
		if decoded.MsgType > 0 {
			v := decoded.MsgType
			row.MsgType = &v
		}
		row.Trace = decoded.Trace
		row.PCode = decoded.PCode
		row.Amount = decoded.Amount
		row.MaskedPan = decoded.MaskedPan

		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	return out, nil
}
