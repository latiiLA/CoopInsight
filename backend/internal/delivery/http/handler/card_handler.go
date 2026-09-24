package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type CardHandler interface {
	CountCardPerStatus(c *gin.Context)
	CardActivity(c *gin.Context)
	CardActivityByBranch(c *gin.Context)
	CardBranchTrend(c *gin.Context)
}

type cardHandler struct {
	service service.CardService
}

func NewCardHandler(service service.CardService) CardHandler {
	return &cardHandler{service: service}
}

func (h *cardHandler) CountCardPerStatus(c *gin.Context) {
	dateFrom := c.Query("dateFrom")
	dateTo := c.Query("dateTo")

	result, err := h.service.CountCardPerStatus(
		c,
		dateFrom,
		dateTo,
	)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Card status report fetched successfully",
		Data: gin.H{
			"items": result,
		},
	})
}

func (h *cardHandler) CardActivity(c *gin.Context) {
	dateFrom := c.Query("dateFrom")
	dateTo := c.Query("dateTo")

	report, err := h.service.CardActivity(c, dateFrom, dateTo)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Card activity report fetched successfully",
		Data: gin.H{
			"report": report,
		},
	})
}

func (h *cardHandler) CardActivityByBranch(c *gin.Context) {
	dateFrom := c.Query("dateFrom")
	dateTo := c.Query("dateTo")

	branches, err := h.service.CardActivityByBranch(c, dateFrom, dateTo)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Card activity by branch fetched successfully",
		Data: gin.H{
			"items": branches,
		},
	})
}

func (h *cardHandler) CardBranchTrend(c *gin.Context) {
	branchID, err := strconv.ParseInt(c.Query("branchId"), 10, 64)
	if err != nil || branchID <= 0 {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      "A valid branchId query parameter is required",
		})
		return
	}

	dateFrom := c.Query("dateFrom")
	dateTo := c.Query("dateTo")

	report, err := h.service.CardBranchTrend(c, branchID, dateFrom, dateTo)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Branch card activity fetched successfully",
		Data: gin.H{
			"report": report,
		},
	})
}
