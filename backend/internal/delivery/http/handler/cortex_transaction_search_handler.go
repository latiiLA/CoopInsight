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

type CortexTransactionSearchHandler interface {
	Search(c *gin.Context)
	GetByID(c *gin.Context)
}

type cortexTransactionSearchHandler struct {
	service service.CortexTransactionSearchService
}

func NewCortexTransactionSearchHandler(
	service service.CortexTransactionSearchService,
) CortexTransactionSearchHandler {
	return &cortexTransactionSearchHandler{service: service}
}

func (h *cortexTransactionSearchHandler) Search(c *gin.Context) {
	req, page, pageSize, ok := parseCortexTxnSearchRequest(c)
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
	if result.Items == nil {
		result.Items = []model.CortexTransaction{}
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Cortex transaction search completed successfully",
		Data:         result,
	})
}

func (h *cortexTransactionSearchHandler) GetByID(c *gin.Context) {
	tlogID, err := strconv.ParseInt(strings.TrimSpace(c.Param("tlogId")), 10, 64)
	if err != nil || tlogID < 1 {
		writeAppError(c, common.ErrInvalidCortexTlogID)
		return
	}

	detail, err := h.service.GetByID(
		c.Request.Context(),
		tlogID,
		middleware.HasPermission(c, cardholderNamePermission),
	)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Cortex transaction detail fetched successfully",
		Data:         detail,
	})
}

func parseCortexTxnSearchRequest(c *gin.Context) (model.CortexTransactionSearchRequest, int, int, bool) {
	page, pageSize := parseClearingPagination(c)
	if pageSize > 500 {
		pageSize = 500
	}
	amtMin, ok := parseOptionalFloatQuery(c, "amountMin")
	if !ok {
		return model.CortexTransactionSearchRequest{}, 0, 0, false
	}
	amtMax, ok := parseOptionalFloatQuery(c, "amountMax")
	if !ok {
		return model.CortexTransactionSearchRequest{}, 0, 0, false
	}
	tlogID, ok := parseOptionalInt64Query(c, "tlogId")
	if !ok {
		return model.CortexTransactionSearchRequest{}, 0, 0, false
	}

	req := model.CortexTransactionSearchRequest{
		DateFrom:         strings.TrimSpace(c.Query("dateFrom")),
		DateTo:           strings.TrimSpace(c.Query("dateTo")),
		Product:          strings.TrimSpace(c.Query("product")),
		Card:             strings.TrimSpace(c.Query("card")),
		Cardholder:       strings.TrimSpace(c.Query("cardholder")),
		Branch:           strings.TrimSpace(c.Query("branch")),
		Q:                strings.TrimSpace(c.Query("q")),
		RRN:              strings.TrimSpace(c.Query("rrn")),
		Merchant:         strings.TrimSpace(c.Query("merchant")),
		Terminal:         strings.TrimSpace(c.Query("terminal")),
		TxnCode:          strings.TrimSpace(c.Query("txnCode")),
		TlogID:           tlogID,
		STAN:             strings.TrimSpace(c.Query("stan")),
		Account:          strings.TrimSpace(c.Query("account")),
		ApprovalCode:     strings.TrimSpace(c.Query("approvalCode")),
		RspCode:          strings.TrimSpace(c.Query("rspCode")),
		Currency:         strings.TrimSpace(c.Query("currency")),
		MCC:              strings.TrimSpace(c.Query("mcc")),
		AcquiringCountry: strings.TrimSpace(c.Query("acquiringCountry")),
		Result:           strings.TrimSpace(c.Query("result")),
		Reversal:         strings.TrimSpace(c.Query("reversal")),
		AmountMin:        amtMin,
		AmountMax:        amtMax,
	}
	return req, page, pageSize, true
}
