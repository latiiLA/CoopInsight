package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerClearingRoutes(
	protected *gin.RouterGroup,
	unclearedHandler handler.UnclearedHandler,
) {
	clearing := protected.Group("/clearing")

	clearing.GET(
		"/uncleared/eth",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"clearing:view-uncleared-eth"},
		),
		unclearedHandler.ListETH,
	)
	clearing.GET(
		"/uncleared/visa",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"clearing:view-uncleared-visa"},
		),
		unclearedHandler.ListVisa,
	)
	clearing.GET(
		"/uncleared/mastercard",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"clearing:view-uncleared-mastercard"},
		),
		unclearedHandler.ListMastercard,
	)
}
