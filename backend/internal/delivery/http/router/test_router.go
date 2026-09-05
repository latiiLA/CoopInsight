package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
)

func registerTestRoutes(protected *gin.RouterGroup, testHandler handler.TestHandler) {
	users := protected.Group("/tests")

	users.GET("/test", testHandler.GetTestData)
	// group.POST("/register", middleware.AuthorizeRolesOrPermissions([]string{}, []string{"user:create"}), authController.Register)

}
