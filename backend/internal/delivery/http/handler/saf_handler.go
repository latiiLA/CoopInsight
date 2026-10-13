package handler

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type SafHandler interface {
	Summary(c *gin.Context)
	List(c *gin.Context)
}

type safHandler struct {
	service service.SafService
}

func NewSafHandler(service service.SafService) SafHandler {
	return &safHandler{service: service}
}

func (h *safHandler) Summary(c *gin.Context) {
	from, to, ok := parseSafRange(c.Query("dateFrom"), c.Query("dateTo"))
	if !ok {
		c.JSON(http.StatusBadRequest, response.Status{
			Message: "dateFrom and dateTo must be YYYY-MM-DD",
			Error:   common.MessInvalidRequest,
		})
		return
	}

	summary, err := h.service.Summary(c.Request.Context(), from, to)
	if err != nil {
		writeSafError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Advice message summary fetched successfully",
		Data:         summary,
	})
}

func (h *safHandler) List(c *gin.Context) {
	from, to, ok := parseSafRange(c.Query("dateFrom"), c.Query("dateTo"))
	if !ok {
		c.JSON(http.StatusBadRequest, response.Status{
			Message: "dateFrom and dateTo must be YYYY-MM-DD",
			Error:   common.MessInvalidRequest,
		})
		return
	}

	status := strings.ToUpper(strings.TrimSpace(c.DefaultQuery("status", "S")))
	switch status {
	case "S", "D", "P":
	default:
		c.JSON(http.StatusBadRequest, response.Status{
			Message: "status must be S, D, or P",
			Error:   common.MessInvalidRequest,
		})
		return
	}

	rows, err := h.service.ListByRange(c.Request.Context(), from, to, status)
	if err != nil {
		writeSafError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Advice messages fetched successfully",
		Data:         rows,
	})
}

func writeSafError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, common.ErrInvalidDateRange):
		writeAppErrorMessage(c, err, "Start date must be on or before end date")
	case errors.Is(err, common.ErrOracleUnavailable),
		errors.Is(err, common.ErrFailedToFetchReport):
		writeAppErrorMessage(c, err, common.MessOracleUnavailable)
	default:
		writeAppError(c, err)
	}
}

func parseSafRange(rawFrom, rawTo string) (time.Time, time.Time, bool) {
	rawFrom = strings.TrimSpace(rawFrom)
	rawTo = strings.TrimSpace(rawTo)
	today := truncateSafHandlerDay(time.Now())

	if rawFrom == "" && rawTo == "" {
		return today, today, true
	}
	if rawFrom == "" {
		rawFrom = rawTo
	}
	if rawTo == "" {
		rawTo = rawFrom
	}

	from, err := time.Parse("2006-01-02", rawFrom)
	if err != nil {
		return time.Time{}, time.Time{}, false
	}
	to, err := time.Parse("2006-01-02", rawTo)
	if err != nil {
		return time.Time{}, time.Time{}, false
	}
	return from, to, true
}

func truncateSafHandlerDay(day time.Time) time.Time {
	y, m, d := day.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}
