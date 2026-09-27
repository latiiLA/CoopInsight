package oracle

import (
	"strings"
	"testing"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

// forbiddenCardDetailColumns must never appear in a detail query. PCI-DSS
// forbids storing or logging CVV, CVC, PVV, PVKI and PINSMADE, and a card
// holder's date of birth has no business in an activity list. This test exists
// so a future edit to the projection cannot add one by accident.
var forbiddenCardDetailColumns = []string{
	"CVV",
	"CVC",
	"PVV",
	"PVKI",
	"PINSMADE",
	"DATE_BIRTH",
}

func TestBuildCardDetailQueryMasksCardNumber(t *testing.T) {
	query, err := buildCardDetailQuery(model.CardMetricCreated, false, "", 3, 4)
	if err != nil {
		t.Fatalf("buildCardDetailQuery: %v", err)
	}

	// The raw PAN columns must not be projected.
	if strings.Contains(query, "c.PAN,") || strings.Contains(query, "c.PAN ") {
		t.Error("raw PAN is projected; only PAN_DISPLAY may be used")
	}

	// The mask must be applied in SQL, not left to the caller.
	if !strings.Contains(query, "SUBSTR(c.PAN_DISPLAY, 1, 6)") {
		t.Error("PAN_DISPLAY is not masked with a leading SUBSTR")
	}
	if !strings.Contains(query, "SUBSTR(c.PAN_DISPLAY, -4)") {
		t.Error("PAN_DISPLAY is not masked with a trailing SUBSTR")
	}
	if !strings.Contains(query, "AS CARD_MASKED") {
		t.Error("masked value is not aliased CARD_MASKED")
	}
}

func TestBuildCardDetailQueryExcludesForbiddenColumns(t *testing.T) {
	for _, metric := range []string{
		model.CardMetricCreated,
		model.CardMetricIssued,
		model.CardMetricActivated,
	} {
		for _, includeCardholder := range []bool{false, true} {
			query, err := buildCardDetailQuery(metric, includeCardholder, "", 3, 4)
			if err != nil {
				t.Fatalf("metric %s cardholder=%v: %v", metric, includeCardholder, err)
			}

			upper := strings.ToUpper(query)
			for _, column := range forbiddenCardDetailColumns {
				if strings.Contains(upper, column) {
					t.Errorf(
						"metric %s cardholder=%v: query references forbidden column %s",
						metric, includeCardholder, column,
					)
				}
			}
		}
	}
}

func TestBuildCardDetailQueryCardholderGatedByPermission(t *testing.T) {
	denied, err := buildCardDetailQuery(model.CardMetricCreated, false, "", 3, 4)
	if err != nil {
		t.Fatalf("buildCardDetailQuery: %v", err)
	}
	if strings.Contains(denied, "FIRSTNAME") || strings.Contains(denied, "LASTNAME") {
		t.Error("cardholder name is selected for a caller without the permission")
	}

	permitted, err := buildCardDetailQuery(model.CardMetricCreated, true, "", 3, 4)
	if err != nil {
		t.Fatalf("buildCardDetailQuery: %v", err)
	}
	if !strings.Contains(permitted, "AS CARDHOLDER_NAME") {
		t.Error("cardholder name is not selected for a permitted caller")
	}
	// The localized given name is preferred where it exists.
	if !strings.Contains(permitted, "L10N_FIRSTNAME") {
		t.Error("cardholder name does not prefer the localized first name")
	}
	if !strings.Contains(permitted, "NULLIF(TRIM(c.FIRSTNAME), '')") {
		t.Error("cardholder name has no fallback to the base first name")
	}
}

// FIRSTNAME and LASTNAME both hold the cardholder's full name, so projecting
// both columns printed every name twice. The given name is the whole point of
// the column, and a repeated name is a data defect rather than a display choice,
// so it is pinned here rather than left to a future refactor.
func TestCardDetailCardholderShowsGivenNameOnly(t *testing.T) {
	column := cardDetailPermittedCardholderColumn

	if strings.Contains(column, "c.LASTNAME") {
		t.Error("LASTNAME is projected; it duplicates FIRSTNAME and doubles the name")
	}
	if strings.Contains(column, "L10N_LASTNAME") {
		t.Error("L10N_LASTNAME is projected; it is a patronymic, not a given name")
	}
	if strings.Contains(column, "||") {
		t.Error("cardholder name concatenates columns, which is what doubled the name")
	}

	permitted, err := buildCardDetailQuery(model.CardMetricCreated, true, "", 3, 4)
	if err != nil {
		t.Fatalf("buildCardDetailQuery: %v", err)
	}
	if strings.Contains(permitted, "LASTNAME") {
		t.Error("a surname reaches the card detail projection")
	}
}

func TestBuildCardDetailQueryUsesMetricDateColumn(t *testing.T) {
	cases := map[string]string{
		model.CardMetricCreated:   "c.DATE_CREATED",
		model.CardMetricIssued:    "x.DATELSTISSUED",
		model.CardMetricActivated: "x.DATE_ACTIVATION",
	}

	for metric, column := range cases {
		query, err := buildCardDetailQuery(metric, false, "", 3, 4)
		if err != nil {
			t.Fatalf("metric %s: %v", metric, err)
		}
		if !strings.Contains(query, column) {
			t.Errorf("metric %s: query does not filter or sort on %s", metric, column)
		}
		// The metric's column must drive both the filter and the sort, or
		// paging would be unstable.
		if strings.Count(query, column) < 3 {
			t.Errorf(
				"metric %s: %s should appear in the lower bound, upper bound and ORDER BY",
				metric, column,
			)
		}
	}
}

func TestBuildCardDetailQueryRejectsUnknownMetric(t *testing.T) {
	if _, err := buildCardDetailQuery("destroyed", false, "", 3, 4); err == nil {
		t.Error("an unknown metric should be rejected before reaching the database")
	}
}

func TestBuildCardDetailQueryBranchFilterIsOptional(t *testing.T) {
	all, err := buildCardDetailQuery(model.CardMetricCreated, false, "", 3, 4)
	if err != nil {
		t.Fatalf("buildCardDetailQuery: %v", err)
	}
	if strings.Contains(all, "BRANCH_ID =") {
		t.Error("branch filter is applied when no branch was requested")
	}

	one, err := buildCardDetailQuery(
		model.CardMetricCreated, false, "\n\t\tAND c.BRANCH_ID = :branch_id", 4, 5,
	)
	if err != nil {
		t.Fatalf("buildCardDetailQuery: %v", err)
	}
	if !strings.Contains(one, "c.BRANCH_ID = :branch_id") {
		t.Error("branch filter is missing when a branch was requested")
	}
}

func TestBuildCardDetailQueryPagesWithStableOrder(t *testing.T) {
	query, err := buildCardDetailQuery(model.CardMetricCreated, false, "", 3, 4)
	if err != nil {
		t.Fatalf("buildCardDetailQuery: %v", err)
	}

	if !strings.Contains(query, "ORDER BY c.DATE_CREATED DESC, c.ID DESC") {
		t.Error("paging requires a stable, unique sort order")
	}
	if !strings.Contains(query, "OFFSET :3 ROWS") {
		t.Error("offset bind is missing or misnumbered")
	}
	if !strings.Contains(query, "FETCH NEXT :4 ROWS ONLY") {
		t.Error("fetch bind is missing or misnumbered")
	}
}

func TestNormalizeCardDetailPage(t *testing.T) {
	cases := []struct {
		name           string
		page, pageSize int
		wantPage       int
		wantPageSize   int
	}{
		{"defaults when both invalid", 0, 0, 1, cardDetailDefaultPageSize},
		{"negative page falls back to first", -3, 50, 1, 50},
		{"oversized page is capped", 1, 99999, 1, cardDetailMaxPageSize},
		{"valid values pass through", 4, 250, 4, 250},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			page, pageSize := normalizeCardDetailPage(tc.page, tc.pageSize)
			if page != tc.wantPage {
				t.Errorf("page = %d, want %d", page, tc.wantPage)
			}
			if pageSize != tc.wantPageSize {
				t.Errorf("pageSize = %d, want %d", pageSize, tc.wantPageSize)
			}
		})
	}
}
