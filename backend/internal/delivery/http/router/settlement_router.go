package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerSettlementRoutes(
	protected *gin.RouterGroup,
	unsettledHandler handler.UnsettledHandler,
) {
	settlement := protected.Group("/settlement")

	settlement.GET(
		"/unsettled/eth",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"settlement:view-unsettled-eth"},
		),
		unsettledHandler.ListETH,
	)
}
