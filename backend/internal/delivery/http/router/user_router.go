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
	users.DELETE("/:id", userHandler.Delete)
}
