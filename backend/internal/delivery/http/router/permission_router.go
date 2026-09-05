package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerPermissionRoutes(protected *gin.RouterGroup, permissionHandler handler.PermissionHandler) {
	permissions := protected.Group("/permissions")

	permissions.GET("", permissionHandler.GetAll)
	permissions.GET(
		"/:id",
		middleware.AuthorizeRolesOrPermissions([]string{}, []string{"permission:view", "permission:view-details", "permission:update"}),
		permissionHandler.GetByID,
	)
	permissions.POST("", middleware.AuthorizeRolesOrPermissions([]string{"SUPERADMIN"}, []string{"permission:create"}), permissionHandler.Create)
	permissions.PUT(
		"/:id",
		middleware.AuthorizeRolesOrPermissions([]string{"SUPERADMIN"}, []string{"permission:update"}),
		permissionHandler.Update,
	)
	permissions.DELETE(
		"/:id",
		middleware.AuthorizeRolesOrPermissions([]string{"SUPERADMIN"}, []string{"permission:delete"}),
		permissionHandler.Delete,
	)
}
