package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerRoleRoutes(protected *gin.RouterGroup, roleHandler handler.RoleHandler) {
	roles := protected.Group("/roles")

	roles.GET("", roleHandler.GetAll)
	roles.GET("/:id", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"role:view", "role:view-details", "role:update"}), roleHandler.GetByID)
	roles.POST("", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"role:create"}), roleHandler.Create)
	roles.PUT("/:id", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"role:update"}), roleHandler.Update)
	roles.DELETE("/:id", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"role:delete"}), roleHandler.Delete)
}
