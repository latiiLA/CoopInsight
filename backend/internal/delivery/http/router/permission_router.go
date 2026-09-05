package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerPermissionRoutes(protected *gin.RouterGroup, permissionHandler handler.PermissionHandler) {
	permissions := protected.Group("/permissions")

	permissions.GET("", permissionHandler.GetAll)
	permissions.POST("", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"permission:add"}), permissionHandler.Create)
}
