package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

const cardDetailsQuery = "/api/card/details?metric=created&dateFrom=09/01/2026&dateTo=09/07/2026"

// stubCardService records the includeCardholder flag the handler decided on.
type stubCardService struct {
	service.CardService

	includeCardholder bool
	called            bool
	metric            string
	dateFrom          string
	dateTo            string
	branchID          *int64
	page              int
	pageSize          int
}

func (s *stubCardService) CardDetails(
	_ context.Context,
	metric string,
	dateFrom string,
	dateTo string,
	branchID *int64,
	page int,
	pageSize int,
	includeCardholder bool,
) (service.CardDetailPage, error) {
	s.called = true
	s.metric = metric
	s.dateFrom = dateFrom
	s.dateTo = dateTo
	s.branchID = branchID
	s.page = page
	s.pageSize = pageSize
	s.includeCardholder = includeCardholder

	items := []model.CardDetail{{CardID: 1, CardMasked: "424312XXXXXX7346"}}
	if includeCardholder {
		items[0].CardholderName = "TEST CARDHOLDER"
	}

	return service.CardDetailPage{
		Items:             items,
		Page:              page,
		PageSize:          pageSize,
		Metric:            metric,
		CardholderVisible: includeCardholder,
	}, nil
}

// newCardDetailsRequest builds a context carrying the given permission claim.
// The recorder is supplied to CreateTestContext rather than assigned to
// c.Writer, because httptest.ResponseRecorder does not satisfy
// gin.ResponseWriter.
func newCardDetailsRequest(
	target string,
	permissions []string,
) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodGet, target, nil)
	c.Set("claims", jwt.MapClaims{
		"userId":      "user-1",
		"role":        "AUDITOR",
		"permissions": permissions,
	})

	return c, rec
}

func decodeCardDetailsResponse(t *testing.T, rec *httptest.ResponseRecorder) response.Status {
	t.Helper()

	var status response.Status
	if err := json.Unmarshal(rec.Body.Bytes(), &status); err != nil {
		t.Fatalf("decode response: %v (body=%s)", err, rec.Body.String())
	}
	return status
}

// A caller without card:view-cardholder-name must not have the name column
// requested at all, so the value is never read from the database for them.
func TestCardDetailsWithholdsCardholderName(t *testing.T) {
	stub := &stubCardService{}
	h := NewCardHandler(stub)

	c, rec := newCardDetailsRequest(cardDetailsQuery, []string{"card:view-card-details"})
	h.CardDetails(c)

	if !stub.called {
		t.Fatal("service was not called")
	}
	if stub.includeCardholder {
		t.Error("service was asked for the cardholder name without the permission")
	}

	status := decodeCardDetailsResponse(t, rec)
	if !status.IsSuccessful {
		t.Fatalf("expected a successful response, got %+v", status)
	}
}

// Holding the permission must switch the name column on.
func TestCardDetailsIncludesCardholderNameWhenPermitted(t *testing.T) {
	stub := &stubCardService{}
	h := NewCardHandler(stub)

	c, rec := newCardDetailsRequest(cardDetailsQuery, []string{
		"card:view-card-details",
		"card:view-cardholder-name",
	})
	h.CardDetails(c)

	if !stub.includeCardholder {
		t.Error("service was not asked for the cardholder name despite the permission")
	}

	status := decodeCardDetailsResponse(t, rec)
	if !status.IsSuccessful {
		t.Fatalf("expected a successful response, got %+v", status)
	}
}

// Permission matching should ignore case and padding, matching the behaviour of
// the AuthorizeRolesOrPermissions middleware.
func TestCardDetailsPermissionMatchingIsTolerant(t *testing.T) {
	stub := &stubCardService{}
	h := NewCardHandler(stub)

	c, _ := newCardDetailsRequest(
		cardDetailsQuery, []string{"  CARD:VIEW-CARDHOLDER-NAME  "},
	)
	h.CardDetails(c)

	if !stub.includeCardholder {
		t.Error("permission should match despite case and padding")
	}
}

// With no claims at all the name must be withheld rather than defaulted on.
func TestCardDetailsWithoutClaimsWithholdsCardholderName(t *testing.T) {
	stub := &stubCardService{}
	h := NewCardHandler(stub)

	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodGet, cardDetailsQuery, nil)

	h.CardDetails(c)

	if stub.includeCardholder {
		t.Error("name requested even though the request carried no claims")
	}
}

func TestCardDetailsParsesQuery(t *testing.T) {
	stub := &stubCardService{}
	h := NewCardHandler(stub)

	c, _ := newCardDetailsRequest(
		"/api/card/details?metric=issued&dateFrom=09/01/2026&dateTo=09/07/2026"+
			"&branchId=124&page=3&pageSize=25",
		[]string{"card:view-card-details"},
	)
	h.CardDetails(c)

	if stub.metric != "issued" {
		t.Errorf("metric = %q, want issued", stub.metric)
	}
	if stub.dateFrom != "09/01/2026" || stub.dateTo != "09/07/2026" {
		t.Errorf("dates = %q..%q", stub.dateFrom, stub.dateTo)
	}
	if stub.branchID == nil || *stub.branchID != 124 {
		t.Errorf("branchId = %v, want 124", stub.branchID)
	}
	if stub.page != 3 || stub.pageSize != 25 {
		t.Errorf("page/pageSize = %d/%d, want 3/25", stub.page, stub.pageSize)
	}
}

// Omitted paging params must fall back to defaults rather than reaching the
// repository as zero.
func TestCardDetailsPaginationDefaults(t *testing.T) {
	stub := &stubCardService{}
	h := NewCardHandler(stub)

	c, _ := newCardDetailsRequest(
		cardDetailsQuery, []string{"card:view-card-details"},
	)
	h.CardDetails(c)

	if stub.page != 1 {
		t.Errorf("page = %d, want 1", stub.page)
	}
	if stub.pageSize != 200 {
		t.Errorf("pageSize = %d, want 200", stub.pageSize)
	}
}

// Unusable paging params are ignored rather than rejected, so a stale bookmark
// cannot break the list.
func TestCardDetailsIgnoresUnusablePagination(t *testing.T) {
	stub := &stubCardService{}
	h := NewCardHandler(stub)

	c, _ := newCardDetailsRequest(
		cardDetailsQuery+"&page=abc&pageSize=-4",
		[]string{"card:view-card-details"},
	)
	h.CardDetails(c)

	if stub.page != 1 || stub.pageSize != 200 {
		t.Errorf("page/pageSize = %d/%d, want 1/200", stub.page, stub.pageSize)
	}
}

func TestCardDetailsRejectsBadBranchID(t *testing.T) {
	cases := map[string]string{
		"non-numeric": cardDetailsQuery + "&branchId=abc",
		"negative":    cardDetailsQuery + "&branchId=-3",
		"zero":        cardDetailsQuery + "&branchId=0",
	}

	for name, target := range cases {
		t.Run(name, func(t *testing.T) {
			stub := &stubCardService{}
			h := NewCardHandler(stub)

			c, rec := newCardDetailsRequest(
				target, []string{"card:view-card-details"},
			)
			h.CardDetails(c)

			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want 400", rec.Code)
			}
			if stub.called {
				t.Error("service was called despite an invalid branchId")
			}
		})
	}
}
