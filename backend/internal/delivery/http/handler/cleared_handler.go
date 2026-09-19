package handler

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type ClearedHandler interface {
	ListETH(c *gin.Context)
	ListVisa(c *gin.Context)
	ListMastercard(c *gin.Context)
}

type clearedHandler struct {
	service service.ClearedService
}

func NewClearedHandler(service service.ClearedService) ClearedHandler {
	return &clearedHandler{service: service}
}

func (h *clearedHandler) ListETH(c *gin.Context) {
	h.list(c, h.service.ListETH)
}

func (h *clearedHandler) ListVisa(c *gin.Context) {
	h.list(c, h.service.ListVisa)
}

func (h *clearedHandler) ListMastercard(c *gin.Context) {
	h.list(c, h.service.ListMastercard)
}

func (h *clearedHandler) list(
	c *gin.Context,
	fetch func(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (service.ClearingPageResult[model.ClearedTransaction], error),
) {
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

	page, pageSize := parseClearingPagination(c)
	result, err := fetch(c.Request.Context(), dateFrom, dateTo, page, pageSize)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Cleared transactions fetched successfully",
		Data:         result,
	})
}
