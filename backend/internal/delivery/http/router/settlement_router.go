package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerSettlementRoutes(
	protected *gin.RouterGroup,
	unsettledHandler handler.UnsettledHandler,
	settledHandler handler.SettledHandler,
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
	settlement.GET(
		"/unsettled/visa",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"settlement:view-unsettled-visa"},
		),
		unsettledHandler.ListVisa,
	)
	settlement.GET(
		"/unsettled/mastercard",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"settlement:view-unsettled-mastercard"},
		),
		unsettledHandler.ListMastercard,
	)

	settlement.GET(
		"/settled/eth",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"settlement:view-settled-eth"},
		),
		settledHandler.ListETH,
	)
	settlement.GET(
		"/settled/visa",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"settlement:view-settled-visa"},
		),
		settledHandler.ListVisa,
	)
	settlement.GET(
		"/settled/mastercard",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"settlement:view-settled-mastercard"},
		),
		settledHandler.ListMastercard,
	)
}
