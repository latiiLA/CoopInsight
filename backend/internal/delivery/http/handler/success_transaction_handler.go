package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type SuccessTransactionHandler interface {
	GetReport(c *gin.Context)
}

type successTransactionHandler struct {
	service service.SuccessTransactionService
}

func NewSuccessTransactionHandler(service service.SuccessTransactionService) SuccessTransactionHandler {
	return &successTransactionHandler{
		service: service,
	}
}

func (h *successTransactionHandler) GetReport(c *gin.Context) {
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

	report, err := h.service.GetReport(c.Request.Context(), dateFrom, dateTo)
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
