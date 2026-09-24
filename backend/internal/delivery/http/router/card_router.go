package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerCardRoutes(
	protected *gin.RouterGroup,
	cardHandler handler.CardHandler,
) {
	clearing := protected.Group("/card")

	clearing.GET(
		"/count-per-status",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"card:view-number-of-cards-per-status"},
		),
		cardHandler.CountCardPerStatus,
	)

	clearing.GET(
		"/activity",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"card:view-activity-dashboard"},
		),
		cardHandler.CardActivity,
	)

	clearing.GET(
		"/activity/by-branch",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"card:view-activity-dashboard"},
		),
		cardHandler.CardActivityByBranch,
	)

	clearing.GET(
		"/activity/branch-trend",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"card:view-activity-dashboard"},
		),
		cardHandler.CardBranchTrend,
	)
}
