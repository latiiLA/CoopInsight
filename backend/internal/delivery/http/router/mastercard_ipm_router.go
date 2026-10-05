package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerMastercardIPMRoutes(protected *gin.RouterGroup, mastercardIPMHandler handler.MastercardIPMHandler) {
	if mastercardIPMHandler == nil {
		return
	}

	ipm := protected.Group("/mastercard-ipm")
	view := middleware.AuthorizeRolesOrPermissions(
		[]string{},
		[]string{"settlement:view-settled-mastercard"},
	)

	ipm.POST("/upload", view, mastercardIPMHandler.UploadReport)
	ipm.GET("", view, mastercardIPMHandler.GetByDateRange)
	ipm.GET("/stan-search", view, mastercardIPMHandler.SearchBySTAN)
	ipm.GET("/transactions/:stan", view, mastercardIPMHandler.GetBySTAN)
	ipm.GET("/pans/:pan", view, mastercardIPMHandler.GetByPAN)
	ipm.GET("/batches", view, mastercardIPMHandler.ListBatchSummaries)
	ipm.GET("/batches/:batchId", view, mastercardIPMHandler.GetBatchSummary)
	ipm.GET("/batches/:batchId/transactions", view, mastercardIPMHandler.GetBatchRecords)
}
