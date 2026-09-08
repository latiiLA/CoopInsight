package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerActivityLogRoutes(protected *gin.RouterGroup, activityLogHandler handler.ActivityLogHandler) {
	if activityLogHandler == nil {
		return
	}

	logs := protected.Group("/activity-logs")
	logs.GET(
		"",
		middleware.AuthorizeRolesOrPermissions(
			[]string{"SUPERADMIN"},
			[]string{"activity:view"},
		),
		activityLogHandler.List,
	)
}
