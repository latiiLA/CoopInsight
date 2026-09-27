package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type TransactionMixHandler interface {
	GetMix(c *gin.Context)
}

type transactionMixHandler struct {
	service service.TransactionMixService
}

func NewTransactionMixHandler(
	service service.TransactionMixService,
) TransactionMixHandler {
	return &transactionMixHandler{service: service}
}

func (h *transactionMixHandler) GetMix(c *gin.Context) {
	dateFrom := c.Query("dateFrom")
	dateTo := c.Query("dateTo")
	channel := c.Query("channel")

	if dateFrom == "" || dateTo == "" {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      common.ErrInvalidReportDate.Error(),
			Error:        common.MessInvalidRequest,
		})
		return
	}

	report, err := h.service.GetMix(
		c.Request.Context(),
		dateFrom,
		dateTo,
		channel,
	)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Transaction mix report fetched successfully",
		Data:         report,
	})
}
