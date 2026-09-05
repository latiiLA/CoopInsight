package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerReportRoutes(protected *gin.RouterGroup, successTransactionHandler handler.SuccessTransactionHandler) {
	reports := protected.Group("/reports")

	reports.GET(
		"/success-transactions",
		middleware.AuthorizeRolesOrPermissions([]string{}, []string{"report:view-success-transactions"}),
		successTransactionHandler.GetReport,
	)
}
