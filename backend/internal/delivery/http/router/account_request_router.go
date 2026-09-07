package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerAccountRequestRoutes(protected *gin.RouterGroup, userHandler handler.UserHandler) {
	requests := protected.Group("/account-requests")

	requests.GET("", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"user:view", "user:create"}), userHandler.ListAccountRequests)
	requests.GET("/:id", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"user:view", "user:create", "user:update"}), userHandler.GetAccountRequest)
}
