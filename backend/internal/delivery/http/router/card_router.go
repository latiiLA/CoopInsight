package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerCardRoutes(
	protected *gin.RouterGroup,
	cardHandler handler.CardHandler,
	prepaidVisaHandler handler.PrepaidVisaHandler,
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

	prepaid := clearing.Group("/prepaid-visa")
	prepaid.GET(
		"/dashboard",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"card:view-prepaid-visa"},
		),
		prepaidVisaHandler.Dashboard,
	)
	prepaid.GET(
		"/top-ups",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"card:view-prepaid-visa"},
		),
		prepaidVisaHandler.TopUps,
	)
	prepaid.GET(
		"/unloads",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"card:view-prepaid-visa"},
		),
		prepaidVisaHandler.Unloads,
	)
	prepaid.GET(
		"/transactions",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"card:view-prepaid-visa"},
		),
		prepaidVisaHandler.Transactions,
	)
	prepaid.GET(
		"/search",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"card:view-prepaid-visa"},
		),
		prepaidVisaHandler.Search,
	)
	prepaid.GET(
		"/reconciliation",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"card:view-prepaid-visa"},
		),
		prepaidVisaHandler.Reconciliation,
	)
	prepaid.GET(
		"/cards/:cardId/activity",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"card:view-prepaid-visa"},
		),
		prepaidVisaHandler.CardActivity,
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

	// Card-level records behind the activity counts. Deliberately a different
	// permission from the dashboard: the counts are aggregates, these are
	// individual cards.
	clearing.GET(
		"/details",
		middleware.AuthorizeRolesOrPermissions(
			[]string{},
			[]string{"card:view-card-details"},
		),
		cardHandler.CardDetails,
	)
}
