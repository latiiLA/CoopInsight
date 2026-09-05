package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerMonitoringRoutes(live *gin.RouterGroup, onusHandler handler.OnusMonitoringHandler) {
	monitoring := live.Group("/monitoring")

	monitoring.GET(
		"/onus/ws",
		middleware.AuthorizeRolesOrPermissions([]string{"SUPERADMIN"}, []string{"monitoring:view-onus"}),
		onusHandler.Stream,
	)
}
