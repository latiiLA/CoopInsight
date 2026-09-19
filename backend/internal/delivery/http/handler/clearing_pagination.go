package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

func parseClearingPagination(c *gin.Context) (page, pageSize int) {
	page = 1
	pageSize = 500

	if raw := c.Query("page"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if raw := c.Query("pageSize"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			pageSize = parsed
		}
	}

	return page, pageSize
}
