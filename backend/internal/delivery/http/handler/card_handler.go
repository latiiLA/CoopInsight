package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

// cardholderNamePermission unlocks the cardholder name column in the card detail
// list. Kept separate from the permission that opens the list, because a name is
// customer PII while a masked card number and a count are not.
const cardholderNamePermission = "card:view-cardholder-name"

type CardHandler interface {
	CountCardPerStatus(c *gin.Context)
	CardActivity(c *gin.Context)
	CardActivityByBranch(c *gin.Context)
	CardBranchTrend(c *gin.Context)
	CardDetails(c *gin.Context)
}

type cardHandler struct {
	service service.CardService
}

func NewCardHandler(service service.CardService) CardHandler {
	return &cardHandler{service: service}
}

// CountCardPerStatus serves the cards-per-status report.
//
// groupBy and dateField are passed through to the service for validation, so a
// bad value is answered with 400 rather than reaching SQL. Unset options fall
// back to the plain status breakdown keyed on the card's creation date, which is
// what the page showed before these options existed.
func (h *cardHandler) CountCardPerStatus(c *gin.Context) {
	groupBy := c.DefaultQuery("groupBy", "status")
	dateField := c.DefaultQuery("dateField", "created")

	filter := repository.CardStatusFilter{
		GroupBy:   groupBy,
		DateField: dateField,
		// Every card in this portfolio expires in 2029 or later, so a short
		// window would report zero for every group. Five years is the smallest
		// default that actually shows the portfolio.
		ExpiringWithinMonths: 60,
	}

	if raw := strings.TrimSpace(c.Query("expiringWithinMonths")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			c.JSON(http.StatusBadRequest, response.Status{
				IsSuccessful: false,
				Message:      "expiringWithinMonths must be a whole number",
			})
			return
		}
		filter.ExpiringWithinMonths = parsed
	}

	// Dates stay as raw strings here; parseCardStatusDates in the service
	// normalises them so a bad format is a 400.
	filter.DateFrom, filter.DateTo = optionalCardStatusDates(
		c.Query("dateFrom"),
		c.Query("dateTo"),
	)

	var err error
	if filter.ProductID, err = optionalPositiveInt(c.Query("productId")); err != nil {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      "productId must be a positive integer",
		})
		return
	}
	if filter.BranchID, err = optionalPositiveInt(c.Query("branchId")); err != nil {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      "branchId must be a positive integer",
		})
		return
	}

	result, err := h.service.CountCardPerStatus(c, filter)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Card status report fetched successfully",
		Data: gin.H{
			"items": result,
			// Echoed so the client can label the rows without repeating its own
			// request, and so a defaulted option is visible.
			"groupBy":              groupBy,
			"dateField":            dateField,
			"expiringWithinMonths": filter.ExpiringWithinMonths,
		},
	})
}

// optionalPositiveInt returns nil for an absent value, and rejects a value that
// is present but not a positive integer.
func optionalPositiveInt(raw string) (*int64, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	parsed, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || parsed <= 0 {
		return nil, errors.New("not a positive integer")
	}
	return &parsed, nil
}

// optionalCardStatusDates converts the MM/dd/yyyy query values to time values.
// An empty value stays nil so the report is unfiltered rather than defaulted to
// a single day. A malformed value becomes the zero time, which the service's
// parser rejects with a 400.
func optionalCardStatusDates(dateFrom, dateTo string) (*time.Time, *time.Time) {
	parse := func(value string) *time.Time {
		if strings.TrimSpace(value) == "" {
			return nil
		}
		parsed, err := time.Parse("01/02/2006", value)
		if err != nil {
			zero := time.Time{}
			return &zero
		}
		return &parsed
	}
	return parse(dateFrom), parse(dateTo)
}

func (h *cardHandler) CardActivity(c *gin.Context) {
	dateFrom := c.Query("dateFrom")
	dateTo := c.Query("dateTo")

	report, err := h.service.CardActivity(c, dateFrom, dateTo)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Card activity report fetched successfully",
		Data: gin.H{
			"report": report,
		},
	})
}

func (h *cardHandler) CardActivityByBranch(c *gin.Context) {
	dateFrom := c.Query("dateFrom")
	dateTo := c.Query("dateTo")

	branches, err := h.service.CardActivityByBranch(c, dateFrom, dateTo)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Card activity by branch fetched successfully",
		Data: gin.H{
			"items": branches,
		},
	})
}

func (h *cardHandler) CardBranchTrend(c *gin.Context) {
	branchID, err := strconv.ParseInt(c.Query("branchId"), 10, 64)
	if err != nil || branchID <= 0 {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      "A valid branchId query parameter is required",
		})
		return
	}

	dateFrom := c.Query("dateFrom")
	dateTo := c.Query("dateTo")

	report, err := h.service.CardBranchTrend(c, branchID, dateFrom, dateTo)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Branch card activity fetched successfully",
		Data: gin.H{
			"report": report,
		},
	})
}

// CardDetails serves one page of individual card records.
//
// The cardholder name is withheld unless the caller holds its own permission,
// and the decision is made here so the repository is never asked for a column
// the caller may not see.
func (h *cardHandler) CardDetails(c *gin.Context) {
	var branchID *int64
	if raw := c.Query("branchId"); raw != "" {
		parsed, err := strconv.ParseInt(raw, 10, 64)
		// Rejected here rather than left to the service, matching how
		// CardBranchTrend guards the same parameter.
		if err != nil || parsed <= 0 {
			c.JSON(http.StatusBadRequest, response.Status{
				IsSuccessful: false,
				Message:      "branchId must be a positive integer",
			})
			return
		}
		branchID = &parsed
	}

	page, pageSize := parseCardDetailPagination(c)

	result, err := h.service.CardDetails(
		c,
		c.Query("metric"),
		c.Query("dateFrom"),
		c.Query("dateTo"),
		branchID,
		page,
		pageSize,
		middleware.HasPermission(c, cardholderNamePermission),
	)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Card details fetched successfully",
		Data: gin.H{
			"details": result,
		},
	})
}

// parseCardDetailPagination reads page and pageSize, ignoring unusable values so
// the service applies its own defaults rather than erroring on bad input.
func parseCardDetailPagination(c *gin.Context) (page, pageSize int) {
	page = 1
	pageSize = 200

	if raw := c.Query("page"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if raw := c.Query("pageSize"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			pageSize = parsed
		}
	}

	return page, pageSize
}
