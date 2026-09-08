package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerAtmTerminalRoutes(protected *gin.RouterGroup, atmTerminalHandler handler.AtmTerminalHandler) {
	terminals := protected.Group("/terminals")

	terminals.GET(
		"/atm",
		middleware.AuthorizeRolesOrPermissions(
			[]string{"SUPERADMIN"},
			[]string{"terminal:view-atm", "terminal:view-atm-transaction"},
		),
		atmTerminalHandler.GetAll,
	)
}
