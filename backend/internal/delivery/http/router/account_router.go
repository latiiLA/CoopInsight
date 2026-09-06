package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
)

func registerAccountRoutes(protected *gin.RouterGroup, userHandler handler.UserHandler) {
	account := protected.Group("/account")
	account.PUT("/avatar", userHandler.UpdateAvatar)
	account.POST("/avatar/photo", userHandler.UploadAvatarPhoto)
	account.PUT("/profile", userHandler.UpdateProfile)
}
