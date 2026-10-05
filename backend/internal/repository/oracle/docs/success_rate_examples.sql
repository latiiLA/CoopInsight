-- success_rate_examples.sql
--
-- Complete, standalone Oracle examples corresponding to the success-rate report
-- in backend/internal/repository/oracle/success_transaction_sql.go.
--
-- Bind :date_from and :date_to as MM-DD-YYYY strings (the format expected by
-- the Go repository). Each statement is independent; run one section at a time.
-- The report's date predicate is intentionally BETWEEN (inclusive), while the
-- reversal lookup keeps the production +2-day pad.
--
-- Approval is exactly the production trulyApproved formula:
--   approvedRespCodes + no matching 410/420/430 reversal; and
--   off-us response codes 5/8 are also treated as approved.
-- Switch uses the ATM routing rules for merchant type 6011 and the POS rules
-- for all other merchant types, matching routingFilterFor("switch", flow).

-- -----------------------------------------------------------------------------
-- ATM / OVERALL
-- -----------------------------------------------------------------------------
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) / NULLIF(COUNT(*), 0)) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
		) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE t.MSGTYPE = 210
	AND t.MERCHANT_TYPE = 6011
	AND (
				(TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('CBOBCORTEX', '8888888888', '04', '05'))
		OR (TRIM(t.ACQUIRER) = '1000000010' AND TRIM(t.TXNDEST) = 'CBOBCORTEX')
	)
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY');
group by t.termid

-- -----------------------------------------------------------------------------
-- ATM / ACQUIRING
-- -----------------------------------------------------------------------------
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) / NULLIF(COUNT(*), 0)) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
		) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE t.MSGTYPE = 210
	AND t.MERCHANT_TYPE = 6011
	AND (
				TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('CBOBCORTEX', '8888888888', '04', '05')
	)
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY');

-- -----------------------------------------------------------------------------
-- ATM / ONUS
-- -----------------------------------------------------------------------------
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) / NULLIF(COUNT(*), 0)) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
		) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE t.MSGTYPE = 210
	AND t.MERCHANT_TYPE = 6011
	AND (
				TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) = 'CBOBCORTEX'
	)
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY');

-- -----------------------------------------------------------------------------
-- ATM / OFFUS
-- -----------------------------------------------------------------------------
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) / NULLIF(COUNT(*), 0)) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
		) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE t.MSGTYPE = 210
	AND t.MERCHANT_TYPE = 6011
	AND (
				TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')
	)
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY');

-- -----------------------------------------------------------------------------
-- ATM / ISSUING
-- -----------------------------------------------------------------------------
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) / NULLIF(COUNT(*), 0)) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
		) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE t.MSGTYPE = 210
	AND t.MERCHANT_TYPE = 6011
	AND (
				TRIM(t.ACQUIRER) = '1000000010' AND TRIM(t.TXNDEST) = 'CBOBCORTEX'
	)
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY');

-- -----------------------------------------------------------------------------
-- POS / OVERALL
-- -----------------------------------------------------------------------------
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) / NULLIF(COUNT(*), 0)) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
		) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE t.MSGTYPE IN (110, 210)
	AND t.MERCHANT_TYPE <> 6011
	AND (
				(TRIM(t.TXNDEST) = 'CBOBCORTEX' AND TRIM(t.TXNSRC) = '402032')
		OR (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05'))
		OR (TRIM(t.ACQUIRER) = '1000000010' AND TRIM(t.TXNDEST) = 'CBOBCORTEX' AND TRIM(t.TXNSRC) <> '402032')
	)
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY');

-- -----------------------------------------------------------------------------
-- POS / ACQUIRING
-- -----------------------------------------------------------------------------
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) / NULLIF(COUNT(*), 0)) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
		) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE t.MSGTYPE IN (110, 210)
	AND t.MERCHANT_TYPE <> 6011
	AND (
				(TRIM(t.TXNDEST) = 'CBOBCORTEX' AND TRIM(t.TXNSRC) = '402032')
		OR (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05'))
	)
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY');

-- -----------------------------------------------------------------------------
-- POS / ONUS
-- -----------------------------------------------------------------------------
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) / NULLIF(COUNT(*), 0)) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
		) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE t.MSGTYPE IN (110, 210)
	AND t.MERCHANT_TYPE <> 6011
	AND (
				TRIM(t.TXNDEST) = 'CBOBCORTEX' AND TRIM(t.TXNSRC) = '402032'
	)
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY');

-- -----------------------------------------------------------------------------
-- POS / OFFUS
-- -----------------------------------------------------------------------------
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) / NULLIF(COUNT(*), 0)) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
		) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE t.MSGTYPE IN (110, 210)
	AND t.MERCHANT_TYPE <> 6011
	AND (
				TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')
	)
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY');

-- -----------------------------------------------------------------------------
-- POS / ISSUING
-- -----------------------------------------------------------------------------
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) / NULLIF(COUNT(*), 0)) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
		) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE t.MSGTYPE IN (110, 210)
	AND t.MERCHANT_TYPE <> 6011
	AND (
				TRIM(t.ACQUIRER) = '1000000010' AND TRIM(t.TXNDEST) = 'CBOBCORTEX' AND TRIM(t.TXNSRC) <> '402032'
	)
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY');

-- -----------------------------------------------------------------------------
-- SWITCH / OVERALL
-- -----------------------------------------------------------------------------
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) / NULLIF(COUNT(*), 0)) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
		) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE ((t.MERCHANT_TYPE = 6011 AND t.MSGTYPE = 210) OR (t.MERCHANT_TYPE <> 6011 AND t.MSGTYPE IN (110, 210)))
	AND 1=1
	AND (
				(t.MERCHANT_TYPE = 6011 AND ((TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('CBOBCORTEX', '8888888888', '04', '05'))
		OR (TRIM(t.ACQUIRER) = '1000000010' AND TRIM(t.TXNDEST) = 'CBOBCORTEX')))
		OR (t.MERCHANT_TYPE <> 6011 AND ((TRIM(t.TXNDEST) = 'CBOBCORTEX' AND TRIM(t.TXNSRC) = '402032')
		OR (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05'))
		OR (TRIM(t.ACQUIRER) = '1000000010' AND TRIM(t.TXNDEST) = 'CBOBCORTEX' AND TRIM(t.TXNSRC) <> '402032')))
	)
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY');

-- -----------------------------------------------------------------------------
-- SWITCH / ACQUIRING
-- -----------------------------------------------------------------------------
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) / NULLIF(COUNT(*), 0)) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
		) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE ((t.MERCHANT_TYPE = 6011 AND t.MSGTYPE = 210) OR (t.MERCHANT_TYPE <> 6011 AND t.MSGTYPE IN (110, 210)))
	AND 1=1
	AND (
				(t.MERCHANT_TYPE = 6011 AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('CBOBCORTEX', '8888888888', '04', '05')))
		OR (t.MERCHANT_TYPE <> 6011 AND ((TRIM(t.TXNDEST) = 'CBOBCORTEX' AND TRIM(t.TXNSRC) = '402032')
		OR (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05'))))
	)
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY');

-- -----------------------------------------------------------------------------
-- SWITCH / ONUS
-- -----------------------------------------------------------------------------
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) / NULLIF(COUNT(*), 0)) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
		) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE ((t.MERCHANT_TYPE = 6011 AND t.MSGTYPE = 210) OR (t.MERCHANT_TYPE <> 6011 AND t.MSGTYPE IN (110, 210)))
	AND 1=1
	AND (
				(t.MERCHANT_TYPE = 6011 AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) = 'CBOBCORTEX'))
		OR (t.MERCHANT_TYPE <> 6011 AND (TRIM(t.TXNDEST) = 'CBOBCORTEX' AND TRIM(t.TXNSRC) = '402032'))
	)
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY');

-- -----------------------------------------------------------------------------
-- SWITCH / OFFUS
-- -----------------------------------------------------------------------------
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) / NULLIF(COUNT(*), 0)) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
		) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE ((t.MERCHANT_TYPE = 6011 AND t.MSGTYPE = 210) OR (t.MERCHANT_TYPE <> 6011 AND t.MSGTYPE IN (110, 210)))
	AND 1=1
	AND (
				(t.MERCHANT_TYPE = 6011 AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
		OR (t.MERCHANT_TYPE <> 6011 AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	)
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY');

-- -----------------------------------------------------------------------------
-- SWITCH / ISSUING
-- -----------------------------------------------------------------------------
WITH rev AS (
	SELECT /*+ MATERIALIZE */ DISTINCT TRIM(REFNUM) AS refnum
	FROM oasis.shclog
	WHERE MSGTYPE IN (410, 420, 430)
		AND REFNUM IS NOT NULL
		AND LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
		AND LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 2
)
SELECT /*+ USE_HASH(t rev) */
	COUNT(*) AS total_number_of_transaction,
	COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_approved_txn,
	COUNT(*) - COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) AS number_of_declined_txn,
	CASE
		WHEN COUNT(*) = 0 THEN 0
		ELSE ROUND(
			(COUNT(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) THEN 1 END) / NULLIF(COUNT(*), 0)) * 100,
			2
		)
	END AS percent_success_rate,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
	) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END) END AS total_approved_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE
		SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) -
		SUM(CASE WHEN (
		(t.respcode IN ('0','2','11','12','13','17','41','42','43','44','46','51','54','55','59','61','62','65','67','75','76','80','89','98','115','251','252','503','902','904','915') AND rev.refnum IS NULL)
		OR (t.respcode IN ('5','8') AND rev.refnum IS NULL
			AND (TRIM(t.ACQUIRER) = '1000000011' AND TRIM(t.TXNDEST) IN ('8888888888', '04', '05')))
		) AND t.amount IS NOT NULL THEN t.amount ELSE 0 END)
	END AS total_declined_amount,
	CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN t.amount IS NULL THEN 0 ELSE t.amount END) END AS total_transaction_amount
FROM oasis.shclog t
LEFT JOIN rev ON rev.refnum = TRIM(t.REFNUM)
WHERE ((t.MERCHANT_TYPE = 6011 AND t.MSGTYPE = 210) OR (t.MERCHANT_TYPE <> 6011 AND t.MSGTYPE IN (110, 210)))
	AND 1=1
	AND (
				(t.MERCHANT_TYPE = 6011 AND (TRIM(t.ACQUIRER) = '1000000010' AND TRIM(t.TXNDEST) = 'CBOBCORTEX'))
		OR (t.MERCHANT_TYPE <> 6011 AND (TRIM(t.ACQUIRER) = '1000000010' AND TRIM(t.TXNDEST) = 'CBOBCORTEX' AND TRIM(t.TXNSRC) <> '402032'))
	)
	AND t.LOCAL_DATE BETWEEN TO_DATE(:date_from, 'MM-DD-YYYY') AND TO_DATE(:date_to, 'MM-DD-YYYY');
