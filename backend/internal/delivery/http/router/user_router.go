package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerUserRoutes(protected *gin.RouterGroup, userHandler handler.UserHandler) {
	users := protected.Group("/users")

	users.GET("", userHandler.GetAll)
	users.GET("/:id", userHandler.GetByID)
	users.POST("", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"user:add"}), userHandler.Create)
	users.PUT("/:id", userHandler.Update)
	users.DELETE("/:id", userHandler.Delete)
}
