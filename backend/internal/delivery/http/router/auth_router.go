package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
)

func registerAuthRoutes(api *gin.RouterGroup, userHandler handler.UserHandler) {
	auth := api.Group("/auth")

	auth.POST("/login-ldap", userHandler.Login)
	auth.POST("/login", userHandler.LoginLocal)
	// group.POST("/register", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"user:add"}), authController.Register)
}
