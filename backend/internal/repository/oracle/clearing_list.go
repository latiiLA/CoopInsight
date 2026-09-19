package oracle

import "database/sql"

// Shared CLEARING.TRANS_LOG list helpers for uncleared / cleared / unsettled / settled.

const (
	clearingDefaultPageSize = 500
	clearingMaxPageSize     = 2000
)

// Date filters use TR_CONV_DATE (indexed via TR_CONV_DATE_IDX). TR_ADDED_DATE has
// no index and forces a full scan of ~44M rows; TR_DATE is often 1980-01-01 for ETH.

// Advice (410/420/430) is always after the original 210; bound lookup to
// r.TR_CONV_DATE >= t.TR_CONV_DATE and through date_to + 1 calendar day.
const clearingAdviceNotExists = `
	AND NOT EXISTS (
		SELECT 1
		FROM clearing.trans_log r
		WHERE r.MSGTYPE IN (410, 420, 430)
			AND r.TR_ARF = t.TR_ARF
			AND r.TR_CONV_DATE >= t.TR_CONV_DATE
			AND r.TR_CONV_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
	)
`

// Stable order required for OFFSET/FETCH pagination.
const clearingOrderBy = `
ORDER BY t.TR_CONV_DATE DESC, t.TR_TIME DESC, t.TR_TRACE DESC
`

const clearingSelectColumns = `
	NVL(t.TRANS_LOG_ID, t.ID) AS id,
	TO_CHAR(t.TR_CONV_DATE, 'YYYY-MM-DD') AS tr_date,
	LPAD(TO_CHAR(NVL(t.TR_TIME, 0)), 6, '0') AS tr_time,
	NVL(t.MSGTYPE, 0) AS msgtype,
	NVL(t.PROC_CODE, 0) AS proc_code,
	t.TR_ARF AS rrn,
	LPAD(TO_CHAR(NVL(t.TR_TRACE, 0)), 6, '0') AS stan,
	t.TR_RESPCODE AS resp_code,
	NVL(t.TR_AMOUNT_SOURCE, 0) AS amount,
	NVL(t.TR_CURRENCY_SOURCE, 0) AS currency,
	t.TR_TERM_ID AS terminal_id,
	RTRIM(t.TR_DBA) AS merchant,
	RTRIM(t.TR_CARDPRODUCT) AS card_product,
	t.TR_TXNSRC AS txn_source,
	t.TR_TXNDEST AS txn_dest,
	t.ISS_ACQ AS issuer_acquirer,
	t.POS_ATM AS pos_atm
`

func normalizeClearingPage(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = clearingDefaultPageSize
	}
	if pageSize > clearingMaxPageSize {
		pageSize = clearingMaxPageSize
	}
	return page, pageSize
}

const clearingPageClause = `
OFFSET :offset ROWS
FETCH NEXT :fetch_limit ROWS ONLY
`

func clearingListArgs(
	sourceBin, destBin int64,
	dateFrom, dateTo string,
	page, pageSize int,
) []any {
	page, pageSize = normalizeClearingPage(page, pageSize)
	offset := (page - 1) * pageSize
	// Fetch one extra row to detect hasMore without a COUNT(*).
	fetchLimit := pageSize + 1
	return []any{
		sql.Named("source_bin", sourceBin),
		sql.Named("dest_bin", destBin),
		sql.Named("date_from", dateFrom),
		sql.Named("date_to", dateTo),
		sql.Named("offset", offset),
		sql.Named("fetch_limit", fetchLimit),
	}
}

func trimClearingPage[T any](rows []T, pageSize int) ([]T, bool) {
	_, pageSize = normalizeClearingPage(1, pageSize)
	if len(rows) > pageSize {
		return rows[:pageSize], true
	}
	return rows, false
}
