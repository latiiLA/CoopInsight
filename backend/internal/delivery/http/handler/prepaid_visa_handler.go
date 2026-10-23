package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type PrepaidVisaHandler interface {
	Dashboard(c *gin.Context)
	TopUps(c *gin.Context)
	Unloads(c *gin.Context)
	Transactions(c *gin.Context)
	Search(c *gin.Context)
	Reconciliation(c *gin.Context)
	CardActivity(c *gin.Context)
}

type prepaidVisaHandler struct {
	service service.PrepaidVisaService
}

func NewPrepaidVisaHandler(service service.PrepaidVisaService) PrepaidVisaHandler {
	return &prepaidVisaHandler{service: service}
}

func (h *prepaidVisaHandler) Dashboard(c *gin.Context) {
	dateFrom, dateTo, ok := requirePrepaidVisaDates(c)
	if !ok {
		return
	}
	product := strings.TrimSpace(c.Query("product"))

	report, err := h.service.GetDashboard(c.Request.Context(), dateFrom, dateTo, product)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Prepaid Visa dashboard fetched successfully",
		Data:         report,
	})
}

func (h *prepaidVisaHandler) TopUps(c *gin.Context) {
	filter, page, pageSize, ok := parsePrepaidVisaListFilter(c)
	if !ok {
		return
	}

	result, err := h.service.ListTopUps(
		c.Request.Context(),
		filter,
		middleware.HasPermission(c, cardholderNamePermission),
		page,
		pageSize,
	)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Prepaid Visa top-ups fetched successfully",
		Data:         result,
	})
}

func (h *prepaidVisaHandler) Unloads(c *gin.Context) {
	filter, page, pageSize, ok := parsePrepaidVisaListFilter(c)
	if !ok {
		return
	}

	result, err := h.service.ListUnloads(
		c.Request.Context(),
		filter,
		middleware.HasPermission(c, cardholderNamePermission),
		page,
		pageSize,
	)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Prepaid Visa unloads fetched successfully",
		Data:         result,
	})
}

func (h *prepaidVisaHandler) Transactions(c *gin.Context) {
	filter, page, pageSize, ok := parsePrepaidVisaListFilter(c)
	if !ok {
		return
	}

	result, err := h.service.ListTransactions(
		c.Request.Context(),
		filter,
		middleware.HasPermission(c, cardholderNamePermission),
		page,
		pageSize,
	)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Prepaid Visa transactions fetched successfully",
		Data:         result,
	})
}

func (h *prepaidVisaHandler) Search(c *gin.Context) {
	req, page, pageSize, ok := parsePrepaidVisaSearchRequest(c)
	if !ok {
		return
	}

	result, err := h.service.Search(
		c.Request.Context(),
		req,
		middleware.HasPermission(c, cardholderNamePermission),
		page,
		pageSize,
	)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Prepaid Visa search completed successfully",
		Data:         result,
	})
}

func (h *prepaidVisaHandler) Reconciliation(c *gin.Context) {
	product := strings.TrimSpace(c.Query("product"))

	report, err := h.service.ListCardReconciliation(
		c.Request.Context(),
		product,
		middleware.HasPermission(c, cardholderNamePermission),
	)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Prepaid Visa card reconciliation fetched successfully",
		Data:         report,
	})
}

func (h *prepaidVisaHandler) CardActivity(c *gin.Context) {
	cardID, err := strconv.ParseInt(strings.TrimSpace(c.Param("cardId")), 10, 64)
	if err != nil || cardID < 1 {
		writeAppError(c, common.ErrInvalidPrepaidVisaCardID)
		return
	}

	topUpPage := parsePositiveIntQuery(c, "topUpPage", 1)
	unloadPage := parsePositiveIntQuery(c, "unloadPage", 1)
	ledgerPage := parsePositiveIntQuery(c, "ledgerPage", 1)
	txnPage := parsePositiveIntQuery(c, "txnPage", 1)
	pageSize := parsePositiveIntQuery(c, "pageSize", 40)
	if pageSize > 100 {
		pageSize = 100
	}
	sections := strings.TrimSpace(c.Query("sections"))

	activity, err := h.service.GetCardActivity(
		c.Request.Context(),
		cardID,
		middleware.HasPermission(c, cardholderNamePermission),
		topUpPage,
		unloadPage,
		ledgerPage,
		txnPage,
		pageSize,
		sections,
	)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Prepaid Visa card activity fetched successfully",
		Data:         activity,
	})
}

func parsePositiveIntQuery(c *gin.Context, key string, fallback int) int {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 {
		return fallback
	}
	return n
}

func requirePrepaidVisaDates(c *gin.Context) (dateFrom, dateTo string, ok bool) {
	dateFrom = strings.TrimSpace(c.Query("dateFrom"))
	dateTo = strings.TrimSpace(c.Query("dateTo"))
	if dateFrom == "" || dateTo == "" {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      common.ErrInvalidReportDate.Error(),
			Error:        common.MessInvalidRequest,
		})
		return "", "", false
	}
	return dateFrom, dateTo, true
}

func parsePrepaidVisaListFilter(c *gin.Context) (model.PrepaidVisaListFilter, int, int, bool) {
	dateFrom, dateTo, ok := requirePrepaidVisaDates(c)
	if !ok {
		return model.PrepaidVisaListFilter{}, 0, 0, false
	}
	page, pageSize := parseClearingPagination(c)
	return model.PrepaidVisaListFilter{
		DateFrom: dateFrom,
		DateTo:   dateTo,
		Product:  strings.TrimSpace(c.Query("product")),
	}, page, pageSize, true
}

func parseOptionalFloatQuery(c *gin.Context, key string) (*float64, bool) {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return nil, true
	}
	v, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      "Invalid " + key,
			Error:        common.MessInvalidRequest,
		})
		return nil, false
	}
	return &v, true
}

func parseOptionalInt64Query(c *gin.Context, key string) (*int64, bool) {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return nil, true
	}
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || v < 1 {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      "Invalid " + key,
			Error:        common.MessInvalidRequest,
		})
		return nil, false
	}
	return &v, true
}

func parsePrepaidVisaSearchRequest(c *gin.Context) (model.PrepaidVisaSearchRequest, int, int, bool) {
	page, pageSize := parseClearingPagination(c)
	amtMin, ok := parseOptionalFloatQuery(c, "amountMin")
	if !ok {
		return model.PrepaidVisaSearchRequest{}, 0, 0, false
	}
	amtMax, ok := parseOptionalFloatQuery(c, "amountMax")
	if !ok {
		return model.PrepaidVisaSearchRequest{}, 0, 0, false
	}

	kind := strings.TrimSpace(c.Query("kind"))
	if kind == "" {
		kind = model.PrepaidVisaSearchKindTransactions
	}

	req := model.PrepaidVisaSearchRequest{
		Kind:        kind,
		DateFrom:    strings.TrimSpace(c.Query("dateFrom")),
		DateTo:      strings.TrimSpace(c.Query("dateTo")),
		Product:     strings.TrimSpace(c.Query("product")),
		Card:        strings.TrimSpace(c.Query("card")),
		Cardholder:  strings.TrimSpace(c.Query("cardholder")),
		Branch:      strings.TrimSpace(c.Query("branch")),
		Q:           strings.TrimSpace(c.Query("q")),
		RRN:         strings.TrimSpace(c.Query("rrn")),
		Merchant:    strings.TrimSpace(c.Query("merchant")),
		Terminal:    strings.TrimSpace(c.Query("terminal")),
		Result:      strings.TrimSpace(c.Query("result")),
		Reversal:    strings.TrimSpace(c.Query("reversal")),
		AmountMin:   amtMin,
		AmountMax:   amtMax,
		Account:     strings.TrimSpace(c.Query("account")),
		Description: strings.TrimSpace(c.Query("description")),
	}
	return req, page, pageSize, true
}
