package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
)

func registerPermissionRoutes(protected *gin.RouterGroup, permissionHandler handler.PermissionHandler) {
	permissions := protected.Group("/permissions")

	permissions.GET("", permissionHandler.GetAll)
}
