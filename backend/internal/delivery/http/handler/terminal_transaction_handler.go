package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type TerminalTransactionHandler interface {
	GetByTerminal(c *gin.Context)
}

type terminalTransactionHandler struct {
	service service.TerminalTransactionService
}

func NewTerminalTransactionHandler(
	service service.TerminalTransactionService,
) TerminalTransactionHandler {
	return &terminalTransactionHandler{
		service: service,
	}
}

func (h *terminalTransactionHandler) GetByTerminal(c *gin.Context) {
	terminalID := c.Query("terminalId")
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

	rows, err := h.service.GetByTerminal(c.Request.Context(), terminalID, dateFrom, dateTo)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Terminal transactions fetched successfully",
		Data:         rows,
	})
}
