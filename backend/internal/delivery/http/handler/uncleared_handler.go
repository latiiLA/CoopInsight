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

type UnclearedHandler interface {
	ListETH(c *gin.Context)
	ListVisa(c *gin.Context)
	ListMastercard(c *gin.Context)
	ListVisaCybersource(c *gin.Context)
}

type unclearedHandler struct {
	service service.UnclearedService
}

func NewUnclearedHandler(service service.UnclearedService) UnclearedHandler {
	return &unclearedHandler{service: service}
}

func (h *unclearedHandler) ListETH(c *gin.Context) {
	h.list(c, h.service.ListETH)
}

func (h *unclearedHandler) ListVisa(c *gin.Context) {
	h.list(c, h.service.ListVisa)
}

func (h *unclearedHandler) ListVisaCybersource(c *gin.Context) {
	h.list(c, h.service.ListVisaCybersource)
}

func (h *unclearedHandler) ListMastercard(c *gin.Context) {
	h.list(c, h.service.ListMastercard)
}

func (h *unclearedHandler) list(
	c *gin.Context,
	fetch func(ctx context.Context, dateFrom, dateTo string, page, pageSize int) (service.ClearingPageResult[model.UnclearedTransaction], error),
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
		Message:      "Uncleared transactions fetched successfully",
		Data:         result,
	})
}
