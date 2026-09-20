package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerUserRoutes(protected *gin.RouterGroup, userHandler handler.UserHandler) {
	users := protected.Group("/users")

	users.GET("", userHandler.GetAll)
	users.GET("/:id", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"user:view-details", "user:update"}), userHandler.GetByID)
	users.POST("", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"user:create"}), userHandler.Create)
	users.PUT("/:id", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"user:update"}), userHandler.Update)
	users.POST("/:id/suspend", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"user:suspend", "user:update"}), userHandler.Suspend)
	users.POST("/:id/unsuspend", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"user:suspend", "user:update"}), userHandler.Unsuspend)
	users.DELETE("/:id", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"user:delete"}), userHandler.Delete)
}
