package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type ActivityLogHandler interface {
	List(c *gin.Context)
}

type activityLogHandler struct {
	service service.ActivityLogService
}

func NewActivityLogHandler(service service.ActivityLogService) ActivityLogHandler {
	return &activityLogHandler{service: service}
}

func (h *activityLogHandler) List(c *gin.Context) {
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

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "50"))

	result, err := h.service.List(
		c,
		dateFrom,
		dateTo,
		c.Query("actor"),
		c.Query("action"),
		c.Query("q"),
		page,
		pageSize,
	)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Activity logs fetched successfully",
		Data:         result,
	})
}
