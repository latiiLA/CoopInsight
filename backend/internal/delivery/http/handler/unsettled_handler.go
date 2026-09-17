package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type UnsettledHandler interface {
	ListETH(c *gin.Context)
}

type unsettledHandler struct {
	service service.UnsettledService
}

func NewUnsettledHandler(service service.UnsettledService) UnsettledHandler {
	return &unsettledHandler{service: service}
}

func (h *unsettledHandler) ListETH(c *gin.Context) {
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

	rows, err := h.service.ListETH(c.Request.Context(), dateFrom, dateTo)
	if err != nil {
		writeAppError(c, err)
		return
	}

	if rows == nil {
		rows = []model.UnsettledTransaction{}
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Unsettled transactions fetched successfully",
		Data:         rows,
	})
}
