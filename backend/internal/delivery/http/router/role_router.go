package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerRoleRoutes(protected *gin.RouterGroup, roleHandler handler.RoleHandler) {
	roles := protected.Group("/roles")

	roles.GET("", roleHandler.GetAll)
	roles.POST("", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"role:add"}), roleHandler.Create)
}
