package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type TestHandler interface {
	GetTestData(c *gin.Context)
}

type testHandler struct {
	service service.TestService
}

func NewTestHandler(service service.TestService) TestHandler {
	return &testHandler{
		service: service,
	}
}

func (h *testHandler) GetTestData(c *gin.Context) {
	dateFrom := c.Query("dateFrom")
	dateTo := c.Query("dateTo")

	if dateFrom == "" || dateTo == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "date_from and date_to are required",
		})
		return
	}

	page, err := strconv.Atoi(c.DefaultQuery("page", "0"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid page",
		})
		return
	}

	pageSize, err := strconv.Atoi(c.DefaultQuery("pageSize", "0"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid pageSize",
		})
		return
	}

	data, err := h.service.GetTestData(c.Request.Context(), dateFrom, dateTo, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to fetch Oracle data",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Oracle data fetched successfully",
		"data":    data,
	})
}
