package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type SuccessTransactionHandler interface {
	GetATMOverall(c *gin.Context)
	GetATMAcquiring(c *gin.Context)
	GetATMOnus(c *gin.Context)
	GetATMOffus(c *gin.Context)
	GetATMIssuing(c *gin.Context)
	GetPOSOverall(c *gin.Context)
	GetPOSAcquiring(c *gin.Context)
	GetPOSOnus(c *gin.Context)
	GetPOSOffus(c *gin.Context)
	GetPOSIssuing(c *gin.Context)
	GetSwitchOverall(c *gin.Context)
	GetSwitchOnus(c *gin.Context)
	GetSwitchOffus(c *gin.Context)
	GetSwitchIssuing(c *gin.Context)
	GetTrend(c *gin.Context)
	ListTransactions(c *gin.Context)
}

type successTransactionHandler struct {
	service service.SuccessTransactionService
}

func NewSuccessTransactionHandler(service service.SuccessTransactionService) SuccessTransactionHandler {
	return &successTransactionHandler{
		service: service,
	}
}

func (h *successTransactionHandler) GetATMOverall(c *gin.Context) {
	h.writeReport(c, "atm", "overall")
}

func (h *successTransactionHandler) GetATMAcquiring(c *gin.Context) {
	h.writeReport(c, "atm", "acquiring")
}

func (h *successTransactionHandler) GetATMOnus(c *gin.Context) {
	h.writeReport(c, "atm", "onus")
}

func (h *successTransactionHandler) GetATMOffus(c *gin.Context) {
	h.writeReport(c, "atm", "offus")
}

func (h *successTransactionHandler) GetATMIssuing(c *gin.Context) {
	h.writeReport(c, "atm", "issuing")
}

func (h *successTransactionHandler) GetPOSOverall(c *gin.Context) {
	h.writeReport(c, "pos", "overall")
}

func (h *successTransactionHandler) GetPOSAcquiring(c *gin.Context) {
	h.writeReport(c, "pos", "acquiring")
}

func (h *successTransactionHandler) GetPOSOnus(c *gin.Context) {
	h.writeReport(c, "pos", "onus")
}

func (h *successTransactionHandler) GetPOSOffus(c *gin.Context) {
	h.writeReport(c, "pos", "offus")
}

func (h *successTransactionHandler) GetPOSIssuing(c *gin.Context) {
	h.writeReport(c, "pos", "issuing")
}

func (h *successTransactionHandler) GetSwitchOverall(c *gin.Context) {
	h.writeReport(c, "switch", "overall")
}

func (h *successTransactionHandler) GetSwitchOnus(c *gin.Context) {
	h.writeReport(c, "switch", "onus")
}

func (h *successTransactionHandler) GetSwitchOffus(c *gin.Context) {
	h.writeReport(c, "switch", "offus")
}

func (h *successTransactionHandler) GetSwitchIssuing(c *gin.Context) {
	h.writeReport(c, "switch", "issuing")
}

func (h *successTransactionHandler) GetTrend(c *gin.Context) {
	dateFrom := c.Query("dateFrom")
	dateTo := c.Query("dateTo")
	channel := c.Query("channel")
	flow := c.Query("flow")
	granularity := c.Query("granularity")

	if dateFrom == "" || dateTo == "" {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      common.ErrInvalidReportDate.Error(),
			Error:        common.MessInvalidRequest,
		})
		return
	}

	if !canViewSuccessRate(c, channel, flow) {
		writeAppError(c, common.ErrForbidden)
		return
	}

	report, err := h.service.GetTrend(
		c.Request.Context(),
		dateFrom,
		dateTo,
		channel,
		flow,
		granularity,
	)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Success rate trend fetched successfully",
		Data:         report,
	})
}

func (h *successTransactionHandler) ListTransactions(c *gin.Context) {
	dateFrom := c.Query("dateFrom")
	dateTo := c.Query("dateTo")
	channel := c.Query("channel")
	flow := c.Query("flow")
	outcome := c.DefaultQuery("outcome", "all")
	respCode := c.Query("respCode")
	limit := 250
	if raw := c.Query("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			limit = parsed
		}
	}

	if dateFrom == "" || dateTo == "" {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      common.ErrInvalidReportDate.Error(),
			Error:        common.MessInvalidRequest,
		})
		return
	}

	rows, err := h.service.ListTransactions(
		c.Request.Context(),
		dateFrom,
		dateTo,
		channel,
		flow,
		outcome,
		respCode,
		limit,
	)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Success transactions fetched successfully",
		Data:         rows,
	})
}

func (h *successTransactionHandler) writeReport(c *gin.Context, channel, flow string) {
	dateFrom := c.Query("dateFrom")
	dateTo := c.Query("dateTo")

	if dateFrom == "" || dateTo == "" {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      common.ErrInvalidReportDate.Error(),
			Error:        common.MessInvalidRequest,
		})
		return
	}

	report, err := h.service.GetReport(c.Request.Context(), dateFrom, dateTo, channel, flow)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Success transaction report fetched successfully",
		Data:         report,
	})
}

func successRatePermissionFor(channel, flow string) string {
	channel = strings.ToLower(strings.TrimSpace(channel))
	flow = strings.ToLower(strings.TrimSpace(flow))
	if channel == "" {
		channel = "atm"
	}
	if flow == "" {
		flow = "acquiring"
	}
	return "report:view-" + channel + "-" + flow + "-success-rate"
}

func canViewSuccessRate(c *gin.Context, channel, flow string) bool {
	claimsValue, exists := c.Get("claims")
	if !exists {
		return false
	}

	var claims map[string]interface{}
	switch typed := claimsValue.(type) {
	case jwt.MapClaims:
		claims = map[string]interface{}(typed)
	case map[string]interface{}:
		claims = typed
	default:
		return false
	}

	if role, ok := claims["role"].(string); ok && strings.EqualFold(role, "SUPERADMIN") {
		return true
	}

	required := []string{
		successRatePermissionFor(channel, flow),
		"report:view-success-transactions",
	}

	rawPermissions, ok := claims["permissions"]
	if !ok {
		return false
	}

	userPerms := extractClaimPermissions(rawPermissions)
	for _, need := range required {
		for _, have := range userPerms {
			if strings.EqualFold(strings.TrimSpace(have), strings.TrimSpace(need)) {
				return true
			}
		}
	}
	return false
}

func extractClaimPermissions(value interface{}) []string {
	switch permissions := value.(type) {
	case []string:
		return permissions
	case []interface{}:
		out := make([]string, 0, len(permissions))
		for _, permission := range permissions {
			if text, ok := permission.(string); ok {
				out = append(out, text)
			}
		}
		return out
	default:
		return nil
	}
}
