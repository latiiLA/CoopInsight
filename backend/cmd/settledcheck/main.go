package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/godror/godror"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	oracleDSN := "user=cooptms password=CPtmsuser_54321# connectString=10.12.40.201:1521/PSPDB"
	oracleDB, err := sql.Open("godror", oracleDSN)
	if err != nil {
		log.Fatalf("Oracle connect: %v", err)
	}
	defer func() { _ = oracleDB.Close() }()

	if err := oracleDB.PingContext(ctx); err != nil {
		log.Fatalf("Oracle ping: %v", err)
	}
	fmt.Println("=== Oracle connected ===\n")

	// Check all combinations of TR_SETTLE and TR_POSTED for Cybersource
	query := `
SELECT
	CASE WHEN t.TR_SETTLE = '0' THEN '0' ELSE '1' END AS settle_status,
	CASE WHEN t.TR_POSTED = 0 THEN '0' ELSE '1' END AS posted_status,
	COUNT(*) AS cnt,
	MIN(t.TR_ARF) AS sample_arf,
	MIN(t.TR_TRACE) AS sample_trace,
	MIN(t.TR_CONV_DATE) AS sample_date
FROM clearing.trans_log t
WHERE t.ISS_ACQ = 'ACQ'
  AND t.POS_ATM = 'POS'
  AND t.MSGTYPE = 230
  AND t.TR_CONV_DATE >= TO_DATE('09-01-2026', 'MM-DD-YYYY')
  AND t.TR_CONV_DATE < TO_DATE('09-28-2026', 'MM-DD-YYYY') + 1
  AND t.TR_SOURCE_BIN = 408158
  AND t.TR_DEST_BIN = 9444444444
GROUP BY
	CASE WHEN t.TR_SETTLE = '0' THEN '0' ELSE '1' END,
	CASE WHEN t.TR_POSTED = 0 THEN '0' ELSE '1' END
ORDER BY settle_status, posted_status
`

	rows, err := oracleDB.QueryContext(ctx, query)
	if err != nil {
		log.Fatalf("Query: %v", err)
	}
	defer rows.Close()

	fmt.Println("=== Cybersource TR_SETTLE / TR_POSTED breakdown (Sep 2026) ===")
	fmt.Printf("%-10s %-10s %-10s %-20s %-12s %-12s\n", "Settle", "Posted", "Count", "Sample ARF", "Sample STAN", "Sample Date")
	fmt.Println(string(make([]byte, 80)))

	for rows.Next() {
		var settle, posted, sampleArf, sampleTrace, sampleDate string
		var cnt int64
		if err := rows.Scan(&settle, &posted, &cnt, &sampleArf, &sampleTrace, &sampleDate); err != nil {
			log.Fatalf("Scan: %v", err)
		}
		fmt.Printf("%-10s %-10s %-10d %-20s %-12s %-12s\n", settle, posted, cnt, sampleArf, sampleTrace, sampleDate)
	}

	// Also show some sample transaction IDs for each combination
	fmt.Println("\n=== Sample transaction IDs per combination ===")
	sampleQuery := `
SELECT
	CASE WHEN t.TR_SETTLE = '0' THEN '0' ELSE '1' END AS settle_status,
	CASE WHEN t.TR_POSTED = 0 THEN '0' ELSE '1' END AS posted_status,
	t.TR_ARF,
	t.TR_TRACE,
	t.TR_AMOUNT_SOURCE,
	t.TR_CONV_DATE
FROM clearing.trans_log t
WHERE t.ISS_ACQ = 'ACQ'
  AND t.POS_ATM = 'POS'
  AND t.MSGTYPE = 230
  AND t.TR_CONV_DATE >= TO_DATE('09-01-2026', 'MM-DD-YYYY')
  AND t.TR_CONV_DATE < TO_DATE('09-28-2026', 'MM-DD-YYYY') + 1
  AND t.TR_SOURCE_BIN = 408158
  AND t.TR_DEST_BIN = 9444444444
ORDER BY settle_status, posted_status, t.TR_CONV_DATE DESC
FETCH FIRST 20 ROWS ONLY
`

	rows2, err := oracleDB.QueryContext(ctx, sampleQuery)
	if err != nil {
		log.Fatalf("Sample query: %v", err)
	}
	defer func() { _ = rows2.Close() }()

	fmt.Printf("%-10s %-10s %-20s %-12s %-15s %-12s\n", "Settle", "Posted", "TR_ARF", "STAN", "Amount", "Date")
	fmt.Println(string(make([]byte, 85)))

	for rows2.Next() {
		var settle, posted, arf, trace, convDate string
		var amount float64
		if err := rows2.Scan(&settle, &posted, &arf, &trace, &amount, &convDate); err != nil {
			log.Fatalf("Scan: %v", err)
		}
		fmt.Printf("%-10s %-10s %-20s %-12s %-15.2f %-12s\n", settle, posted, arf, trace, amount, convDate)
	}
}
