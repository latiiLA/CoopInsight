package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

// The card dashboard offers "Last 12 months" and "This year" presets, so the
// embed allows a full year — unlike the success-rate embed, these are cheap
// per-day counts. Anything wider stays in the logged-in dashboard.
const embedCardMaxRangeDays = 367

// EmbedCardActivityHandler serves the aggregate card activity behind the card
// dashboard to Grafana widgets.
//
// Only counts are exposed: organisation-wide daily activity, per-branch totals
// and a single branch's trend. Card-level records (CardDetails) carry customer
// data and stay behind a user session.
type EmbedCardActivityHandler interface {
	Activity(c *gin.Context)
	ActivityByBranch(c *gin.Context)
	BranchTrend(c *gin.Context)
}

type embedCardActivityHandler struct {
	service service.CardService
}

func NewEmbedCardActivityHandler(svc service.CardService) EmbedCardActivityHandler {
	return &embedCardActivityHandler{service: svc}
}

func (h *embedCardActivityHandler) Activity(c *gin.Context) {
	dateFrom, dateTo, ok := embedCardRange(c)
	if !ok {
		return
	}

	report, err := h.service.CardActivity(c, dateFrom, dateTo)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Card activity report fetched successfully",
		Data:         gin.H{"report": report},
	})
}

func (h *embedCardActivityHandler) ActivityByBranch(c *gin.Context) {
	dateFrom, dateTo, ok := embedCardRange(c)
	if !ok {
		return
	}

	branches, err := h.service.CardActivityByBranch(c, dateFrom, dateTo)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Card activity by branch fetched successfully",
		Data:         gin.H{"items": branches},
	})
}

func (h *embedCardActivityHandler) BranchTrend(c *gin.Context) {
	branchID, err := strconv.ParseInt(c.Query("branchId"), 10, 64)
	if err != nil || branchID <= 0 {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      "A valid branchId query parameter is required",
		})
		return
	}

	dateFrom, dateTo, ok := embedCardRange(c)
	if !ok {
		return
	}

	report, err := h.service.CardBranchTrend(c, branchID, dateFrom, dateTo)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Branch card activity fetched successfully",
		Data:         gin.H{"report": report},
	})
}

// embedCardRange requires an explicit, bounded MM/dd/yyyy range. The logged-in
// endpoints default a missing range to 30 days; the embed refuses instead, so a
// shared-key caller always states — and is capped on — what it scans.
func embedCardRange(c *gin.Context) (string, string, bool) {
	rawFrom := strings.TrimSpace(c.Query("dateFrom"))
	rawTo := strings.TrimSpace(c.Query("dateTo"))

	from, errFrom := time.Parse("01/02/2006", rawFrom)
	to, errTo := time.Parse("01/02/2006", rawTo)
	if errFrom != nil || errTo != nil {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      common.ErrInvalidReportDate.Error(),
			Error:        common.MessInvalidRequest,
		})
		return "", "", false
	}
	if to.Before(from) {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      common.ErrInvalidDateRange.Error(),
			Error:        common.MessInvalidRequest,
		})
		return "", "", false
	}
	if to.Sub(from) > (embedCardMaxRangeDays-1)*24*time.Hour {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      "Embed card range is limited to one year",
			Error:        common.MessInvalidRequest,
		})
		return "", "", false
	}

	return rawFrom, rawTo, true
}
