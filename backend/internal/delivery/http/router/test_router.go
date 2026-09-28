package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerTestRoutes(protected *gin.RouterGroup, testHandler handler.TestHandler) {
	tests := protected.Group("/tests")

	// Diagnostic oracle probe — SUPERADMIN only (was any authenticated user).
	tests.GET("/test", middleware.AuthorizeRolesOrPermissions([]string{"SUPERADMIN"}, []string{}), testHandler.GetTestData)
}
