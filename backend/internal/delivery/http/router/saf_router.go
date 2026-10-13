package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerSafRoutes(protected *gin.RouterGroup, safHandler handler.SafHandler) {
	if safHandler == nil {
		return
	}

	monitoring := protected.Group("/monitoring")
	monitoring.GET(
		"/saf/summary",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"monitoring:view-saf"},
		),
		safHandler.Summary,
	)
	monitoring.GET(
		"/saf/transactions",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"monitoring:view-saf"},
		),
		safHandler.List,
	)
}
