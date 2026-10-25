package handler

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

// alphaResponsePermission unlocks alphabetic host response text on Switch detail.
const alphaResponsePermission = "report:view-alpha-response"

type SwitchTransactionSearchHandler interface {
	Search(c *gin.Context)
	GetByRowID(c *gin.Context)
}

type switchTransactionSearchHandler struct {
	service service.SwitchTransactionSearchService
}

func NewSwitchTransactionSearchHandler(
	service service.SwitchTransactionSearchService,
) SwitchTransactionSearchHandler {
	return &switchTransactionSearchHandler{service: service}
}

func (h *switchTransactionSearchHandler) Search(c *gin.Context) {
	req, page, pageSize, ok := parseSwitchTxnSearchRequest(c)
	if !ok {
		return
	}

	result, err := h.service.Search(c.Request.Context(), req, page, pageSize)
	if err != nil {
		writeAppError(c, err)
		return
	}
	if result.Items == nil {
		result.Items = []model.SwitchTransaction{}
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Switch transaction search completed successfully",
		Data:         result,
	})
}

func (h *switchTransactionSearchHandler) GetByRowID(c *gin.Context) {
	raw := strings.TrimSpace(c.Param("rowId"))
	if raw == "" {
		writeAppError(c, common.ErrInvalidSwitchRowID)
		return
	}
	rowID, err := url.PathUnescape(raw)
	if err != nil || strings.TrimSpace(rowID) == "" {
		writeAppError(c, common.ErrInvalidSwitchRowID)
		return
	}

	detail, err := h.service.GetByRowID(c.Request.Context(), rowID)
	if err != nil {
		writeAppError(c, err)
		return
	}
	if detail != nil && !middleware.HasPermission(c, alphaResponsePermission) {
		detail.AlphaRspCode = ""
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Switch transaction detail fetched successfully",
		Data:         detail,
	})
}

func parseSwitchTxnSearchRequest(c *gin.Context) (model.SwitchTransactionSearchRequest, int, int, bool) {
	page, pageSize := parseClearingPagination(c)
	if pageSize > 500 {
		pageSize = 500
	}
	amtMin, ok := parseOptionalFloatQuery(c, "amountMin")
	if !ok {
		return model.SwitchTransactionSearchRequest{}, 0, 0, false
	}
	amtMax, ok := parseOptionalFloatQuery(c, "amountMax")
	if !ok {
		return model.SwitchTransactionSearchRequest{}, 0, 0, false
	}

	lookupWindow := strings.EqualFold(strings.TrimSpace(c.Query("lookupWindow")), "true") ||
		strings.TrimSpace(c.Query("lookupWindow")) == "1"

	req := model.SwitchTransactionSearchRequest{
		DateFrom:         strings.TrimSpace(c.Query("dateFrom")),
		DateTo:           strings.TrimSpace(c.Query("dateTo")),
		Product:          strings.TrimSpace(c.Query("product")),
		Card:             strings.TrimSpace(c.Query("card")),
		Q:                strings.TrimSpace(c.Query("q")),
		RRN:              strings.TrimSpace(c.Query("rrn")),
		Merchant:         strings.TrimSpace(c.Query("merchant")),
		Terminal:         strings.TrimSpace(c.Query("terminal")),
		TxnCode:          strings.TrimSpace(c.Query("txnCode")),
		Trace:            strings.TrimSpace(c.Query("trace")),
		Account:          strings.TrimSpace(c.Query("account")),
		ApprovalCode:     strings.TrimSpace(c.Query("approvalCode")),
		RspCode:          strings.TrimSpace(c.Query("rspCode")),
		IssuerCurrency:   strings.TrimSpace(c.Query("issuerCurrency")),
		AcquirerCurrency: strings.TrimSpace(c.Query("acquirerCurrency")),
		MCC:              strings.TrimSpace(c.Query("mcc")),
		AcquiringCountry: strings.TrimSpace(c.Query("acquiringCountry")),
		Acquirer:         strings.TrimSpace(c.Query("acquirer")),
		RouteID:          strings.TrimSpace(c.Query("routeId")),
		RouteMatch:       strings.TrimSpace(c.Query("routeMatch")),
		Channel:          strings.TrimSpace(c.Query("channel")),
		MsgType:          strings.TrimSpace(c.Query("msgType")),
		Result:           strings.TrimSpace(c.Query("result")),
		Reversal:         strings.TrimSpace(c.Query("reversal")),
		AmountMin:        amtMin,
		AmountMax:        amtMax,
		LookupWindow:     lookupWindow,
	}
	return req, page, pageSize, true
}
