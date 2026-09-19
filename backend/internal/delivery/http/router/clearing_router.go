package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerClearingRoutes(
	protected *gin.RouterGroup,
	unclearedHandler handler.UnclearedHandler,
	clearedHandler handler.ClearedHandler,
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

	clearing.GET(
		"/cleared/eth",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"clearing:view-cleared-eth"},
		),
		clearedHandler.ListETH,
	)
	clearing.GET(
		"/cleared/visa",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"clearing:view-cleared-visa"},
		),
		clearedHandler.ListVisa,
	)
	clearing.GET(
		"/cleared/mastercard",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"clearing:view-cleared-mastercard"},
		),
		clearedHandler.ListMastercard,
	)
}
