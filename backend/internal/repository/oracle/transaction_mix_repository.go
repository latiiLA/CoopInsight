package oracle

import (
	"context"
	"database/sql"
	"sort"
	"strings"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

// transactionMixQuery groups on the three mix axes at once so the whole report
// costs a single pass over the range. Three separate GROUP BY queries were
// measured at roughly three times the time for the same numbers.
//
// The message type is bucketed rather than filtered, unlike the success-rate
// reports. Those restrict MSGTYPE to authorisations because they measure an
// approval rate; here the spread of message types is the result, so narrowing
// to authorisations would make the type axis report only authorisations.
// The date bound is +1, not +2: LOCAL_DATE is stored date-only (verified, all
// values land on 00:00:00), so an exclusive +1 covers dateTo in full.
const transactionMixQuery = `
SELECT /*+ USE_NL(t) */
	NVL(TRIM(t.CARDPRODUCT), 'unknown') AS scheme,
	NVL(TRIM(t.TXNDEST), 'unknown') AS route,
	CASE
		WHEN t.MSGTYPE IN (210, 110) THEN 'authorisation'
		WHEN t.MSGTYPE IN (410, 430) THEN 'reversal'
		WHEN t.MSGTYPE IN (6110, 6210, 6230, 6410, 6430) THEN 'network'
		ELSE 'other'
	END AS txn_type,
	COUNT(*) AS txn_count,
	NVL(SUM(t.AMOUNT), 0) AS txn_amount,
	NVL(SUM(CASE WHEN t.RESPCODE = '0' THEN 1 ELSE 0 END), 0) AS approved_count
FROM oasis.shclog t
WHERE t.LOCAL_DATE >= TO_DATE(:date_from, 'MM-DD-YYYY')
	AND t.LOCAL_DATE < TO_DATE(:date_to, 'MM-DD-YYYY') + 1
	AND ` + transactionMixChannelFilter + `
GROUP BY NVL(TRIM(t.CARDPRODUCT), 'unknown'),
	NVL(TRIM(t.TXNDEST), 'unknown'),
	CASE
		WHEN t.MSGTYPE IN (210, 110) THEN 'authorisation'
		WHEN t.MSGTYPE IN (410, 430) THEN 'reversal'
		WHEN t.MSGTYPE IN (6110, 6210, 6230, 6410, 6430) THEN 'network'
		ELSE 'other'
	END
`

// transactionMixChannelFilter scopes the report to a channel using the same
// routing rules as the success-rate reports, so the two agree on which rows
// count as ATM and which as POS. Deliberately omits their MSGTYPE restriction.
const transactionMixChannelFilter = `%s`

// mixGroup is one row of the raw aggregate, before it is folded into an axis.
type mixGroup struct {
	scheme string
	route  string
	ttype  string
	count  int64
	amount float64
	// approved only counts rows whose bucket can carry it, so a reversal
	// message does not dilute the approval rate with rows that never ask.
	approved int64
}

// mixBucket accumulates one canonical slice while the rows are folded in.
type mixBucket struct {
	key      string
	label    string
	count    int64
	amount   float64
	reversal int64
}

type transactionMixRepository struct {
	db *sql.DB
}

func NewTransactionMixRepository(db *sql.DB) repository.TransactionMixRepository {
	return &transactionMixRepository{db: db}
}

func (r *transactionMixRepository) GetMix(
	ctx context.Context,
	dateFrom, dateTo, channel string,
) (*model.TransactionMixReport, error) {
	query := strings.Replace(
		transactionMixQuery,
		transactionMixChannelFilter,
		routingFilterFor(channel, "overall"),
		1,
	)

	rows, err := r.db.QueryContext(
		ctx,
		query,
		sql.Named("date_from", dateFrom),
		sql.Named("date_to", dateTo),
	)
	if err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}
	defer func() { _ = rows.Close() }()

	var (
		groups   []mixGroup
		total    int64
		amount   float64
		approved int64
	)

	for rows.Next() {
		var (
			scheme, route, ttype string
			count                int64
			groupAmount          float64
			groupApproved        int64
		)

		if err := rows.Scan(
			&scheme,
			&route,
			&ttype,
			&count,
			&groupAmount,
			&groupApproved,
		); err != nil {
			return nil, wrapError(common.ErrFailedToFetchReport, err)
		}

		groups = append(groups, mixGroup{
			scheme:   scheme,
			route:    route,
			ttype:    ttype,
			count:    count,
			amount:   groupAmount,
			approved: groupApproved,
		})
		total += count
		amount += groupAmount
		approved += groupApproved
	}

	if err := rows.Err(); err != nil {
		return nil, wrapError(common.ErrFailedToFetchReport, err)
	}

	return pivotMix(dateFrom, dateTo, channel, total, amount, approved, groups), nil
}

// pivotMix folds the raw aggregate into the three reported axes.
//
// Each axis is summed independently from the same rows, so the three slices
// each total 100% of the population while describing different properties of
// the same messages. They are not additive with one another.
func pivotMix(
	dateFrom, dateTo, channel string,
	total int64,
	amount float64,
	approved int64,
	groups []mixGroup,
) *model.TransactionMixReport {
	schemes := map[string]*mixBucket{}
	routings := map[string]*mixBucket{}
	types := map[string]*mixBucket{}

	reversals := int64(0)

	for _, group := range groups {
		// Scheme axis
		schemeKey, schemeLabel := canonicalMixScheme(group.scheme)
		bucket := ensureMixBucket(schemes, schemeKey, schemeLabel)
		bucket.count += group.count
		bucket.amount += group.amount
		if group.ttype == model.MixTypeReversal {
			bucket.reversal += group.count
		}

		// Routing axis
		routeKey, routeLabel := canonicalMixRouting(group.route)
		bucket = ensureMixBucket(routings, routeKey, routeLabel)
		bucket.count += group.count
		bucket.amount += group.amount
		if group.ttype == model.MixTypeReversal {
			bucket.reversal += group.count
		}

		// Type axis
		typeKey, typeLabel := canonicalMixType(group.ttype)
		bucket = ensureMixBucket(types, typeKey, typeLabel)
		bucket.count += group.count
		bucket.amount += group.amount

		if group.ttype == model.MixTypeReversal {
			reversals += group.count
		}
	}

	// Read the authorisation total back out of its own bucket. Counting
	// "everything that is not a reversal" would quietly fold network
	// management traffic into the figure and overstate it.
	authorisations := int64(0)
	if authBucket, ok := types[model.MixTypeAuthorisation]; ok {
		authorisations = authBucket.count
	}

	reversalPercent := percentOf(reversals, total)

	return &model.TransactionMixReport{
		DateFrom:           dateFrom,
		DateTo:             dateTo,
		Channel:            channel,
		TotalCount:         total,
		TotalAmount:        amount,
		AuthorisationCount: authorisations,
		ReversalCount:      reversals,
		ReversalPercent:    reversalPercent,
		ApprovedCount:      approved,
		ByScheme:           toMixSegments(schemes, total, amount),
		ByRouting:          toMixSegments(routings, total, amount),
		ByType:             toMixSlices(types, total, amount),
	}
}

func ensureMixBucket(store map[string]*mixBucket, key, label string) *mixBucket {
	if existing, ok := store[key]; ok {
		return existing
	}

	created := &mixBucket{key: key, label: label}
	store[key] = created
	return created
}

func toMixSegments(
	store map[string]*mixBucket,
	total int64,
	amount float64,
) []model.TransactionMixSegment {
	buckets := sortedMixBuckets(store)
	segments := make([]model.TransactionMixSegment, 0, len(buckets))

	for _, bucket := range buckets {
		segments = append(segments, model.TransactionMixSegment{
			TransactionMixSlice: model.TransactionMixSlice{
				Key:           bucket.key,
				Label:         bucket.label,
				Count:         bucket.count,
				CountPercent:  percentOf(bucket.count, total),
				Amount:        bucket.amount,
				AmountPercent: percentOf(bucket.amount, amount),
			},
			ReversalCount:   bucket.reversal,
			ReversalPercent: percentOf(bucket.reversal, bucket.count),
		})
	}

	return segments
}

func toMixSlices(
	store map[string]*mixBucket,
	total int64,
	amount float64,
) []model.TransactionMixSlice {
	buckets := sortedMixBuckets(store)
	slices := make([]model.TransactionMixSlice, 0, len(buckets))

	for _, bucket := range buckets {
		slices = append(slices, model.TransactionMixSlice{
			Key:           bucket.key,
			Label:         bucket.label,
			Count:         bucket.count,
			CountPercent:  percentOf(bucket.count, total),
			Amount:        bucket.amount,
			AmountPercent: percentOf(bucket.amount, amount),
		})
	}

	return slices
}

// sortedMixBuckets returns the buckets largest first, then by key so the order
// is stable for slices of equal size.
func sortedMixBuckets(store map[string]*mixBucket) []*mixBucket {
	buckets := make([]*mixBucket, 0, len(store))
	for _, bucket := range store {
		buckets = append(buckets, bucket)
	}

	sort.Slice(buckets, func(i, j int) bool {
		if buckets[i].count != buckets[j].count {
			return buckets[i].count > buckets[j].count
		}
		return buckets[i].key < buckets[j].key
	})

	return buckets
}

// percentOf works for both counts and amounts, which are stored as different
// numeric types but share the same share-of-total calculation.
func percentOf[T int64 | float64](part, whole T) float64 {
	if whole <= 0 {
		return 0
	}
	return float64(part) / float64(whole) * 100
}

// canonicalMixScheme maps CARDPRODUCT to the scheme names used across the app.
//
// ETB is the currency code the switch stores; every other surface here calls
// the domestic scheme ETH, so the label follows the UI rather than the column.
func canonicalMixScheme(product string) (string, string) {
	switch strings.ToUpper(strings.TrimSpace(product)) {
	case "ETB":
		return "ETB", "ETH"
	case "GAMTAA":
		return "GAMTAA", "Gamtaa"
	case "LOCAL CPA", "LOCALCPA":
		return "LOCAL_CPA", "Local CPA"
	case "VISA":
		return "VISA", "Visa"
	case "MDS":
		return "MASTERCARD", "Mastercard"
	case "CIRRUS":
		return "CIRRUS", "Cirrus"
	case "MAE":
		return "MAE", "MAE"
	case "", "UNKNOWN":
		return "UNKNOWN", "Not recorded"
	default:
		trimmed := strings.TrimSpace(product)
		return strings.ToUpper(trimmed), trimmed
	}
}

// canonicalMixRouting maps TXNDEST to a destination name.
//
// The mapping was read off the data rather than assumed: 04 carries only VISA,
// while 05 and 06 carry MDS and MAE, so 05 and 06 collapse into one Mastercard
// slice and 04 is Visa. An unrecognised code is still reported, labelled by its
// own value, so a newly configured route shows up rather than disappearing.
func canonicalMixRouting(dest string) (string, string) {
	switch strings.TrimSpace(dest) {
	case "CBOBCORTEX":
		return "CBO", "CBO (CoopBank switch)"
	case "CBOETH":
		return "CBO_ETH", "CBO ETH"
	case "8888888888":
		return "ETH", "ETH clearing"
	case "04":
		return "VISA", "Visa"
	case "05", "06":
		return "MASTERCARD", "Mastercard"
	case "1":
		return "DIRECT", "Direct (code 1)"
	case "", "UNKNOWN":
		return "UNKNOWN", "Not recorded"
	default:
		trimmed := strings.TrimSpace(dest)
		return "CODE_" + trimmed, "Code " + trimmed
	}
}

func canonicalMixType(ttype string) (string, string) {
	switch ttype {
	case model.MixTypeAuthorisation:
		return model.MixTypeAuthorisation, "Authorisations"
	case model.MixTypeReversal:
		return model.MixTypeReversal, "Reversals"
	case model.MixTypeNetwork:
		return model.MixTypeNetwork, "Network management"
	default:
		return model.MixTypeOther, "Other"
	}
}
