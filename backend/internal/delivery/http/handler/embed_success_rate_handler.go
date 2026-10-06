package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

// Every embed client shares one key, so an unbounded range would let any holder
// queue arbitrarily large Oracle aggregates. Longer windows belong in the
// logged-in dashboard.
const embedMaxRangeDays = 31

// EmbedSuccessRateHandler serves the read-only success-rate slices that Grafana
// widgets embed.
//
// It holds no query logic of its own: every route delegates to the same service
// the logged-in dashboard uses, so an embed and the UI can never disagree on a
// number. The only difference is the credential — these are guarded by
// EmbedAuthMiddleware rather than a user session.
type EmbedSuccessRateHandler interface {
	GetSwitchOverall(c *gin.Context)
	GetSwitchOnus(c *gin.Context)
	GetSwitchOffus(c *gin.Context)
	GetSwitchIssuing(c *gin.Context)
}

type embedSuccessRateHandler struct {
	service service.SuccessTransactionService
}

func NewEmbedSuccessRateHandler(svc service.SuccessTransactionService) EmbedSuccessRateHandler {
	return &embedSuccessRateHandler{service: svc}
}

func (h *embedSuccessRateHandler) GetSwitchOverall(c *gin.Context) {
	h.write(c, "overall")
}

func (h *embedSuccessRateHandler) GetSwitchOnus(c *gin.Context) {
	h.write(c, "onus")
}

func (h *embedSuccessRateHandler) GetSwitchOffus(c *gin.Context) {
	h.write(c, "offus")
}

func (h *embedSuccessRateHandler) GetSwitchIssuing(c *gin.Context) {
	h.write(c, "issuing")
}

func (h *embedSuccessRateHandler) write(c *gin.Context, flow string) {
	from, okFrom := parseEmbedDate(c.Query("dateFrom"))
	to, okTo := parseEmbedDate(c.Query("dateTo"))
	if !okFrom || !okTo {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      common.ErrInvalidReportDate.Error(),
			Error:        common.MessInvalidRequest,
		})
		return
	}
	if to.Before(from) {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      common.ErrInvalidDateRange.Error(),
			Error:        common.MessInvalidRequest,
		})
		return
	}
	if to.Sub(from) > (embedMaxRangeDays-1)*24*time.Hour {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      "Embed date range is limited to 31 days",
			Error:        common.MessInvalidRequest,
		})
		return
	}

	dateFrom := from.Format("01-02-2006")
	dateTo := to.Format("01-02-2006")

	report, err := h.service.GetReport(c.Request.Context(), dateFrom, dateTo, "switch", flow)
	if err != nil {
		writeAppError(c, err)
		return
	}

	// Echo the normalised range actually served, so a widget caching this
	// response can key on it rather than re-deriving the dates it asked for.
	report.DateFrom = dateFrom
	report.DateTo = dateTo

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Switch success rate fetched successfully",
		Data:         report,
	})
}

func parseEmbedDate(value string) (time.Time, bool) {
	value = strings.TrimSpace(value)
	for _, layout := range []string{"01-02-2006", "01/02/2006"} {
		if t, err := time.Parse(layout, value); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}
