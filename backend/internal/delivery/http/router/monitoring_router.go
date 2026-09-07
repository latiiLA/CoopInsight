package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/configs"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerMonitoringRoutes(
	live *gin.RouterGroup,
	onusHandler handler.OnusMonitoringHandler,
	offusHandler handler.OnusMonitoringHandler,
	mastercardDebitHandler handler.OnusMonitoringHandler,
	mastercardCreditHandler handler.OnusMonitoringHandler,
	switchCommandHandler handler.SwitchCommandHandler,
) {
	monitoring := live.Group("/monitoring")

	monitoring.POST(
		"/switch/commands",
		middleware.AuthorizeRolesOrPermissions([]string{"SUPERADMIN"}, []string{"monitoring:run-switch"}),
		switchCommandHandler.Run,
	)

	if !configs.LiveMonitoringEnabled {
		return
	}

	monitoring.GET(
		"/onus/ws",
		middleware.AuthorizeRolesOrPermissions([]string{"SUPERADMIN"}, []string{"monitoring:view-onus"}),
		onusHandler.Stream,
	)
	monitoring.GET(
		"/offus/ws",
		middleware.AuthorizeRolesOrPermissions([]string{"SUPERADMIN"}, []string{"monitoring:view-offus"}),
		offusHandler.Stream,
	)
	monitoring.GET(
		"/mastercard-debit/ws",
		middleware.AuthorizeRolesOrPermissions([]string{"SUPERADMIN"}, []string{"monitoring:view-mastercard-debit"}),
		mastercardDebitHandler.Stream,
	)
	monitoring.GET(
		"/mastercard-credit/ws",
		middleware.AuthorizeRolesOrPermissions([]string{"SUPERADMIN"}, []string{"monitoring:view-mastercard-credit"}),
		mastercardCreditHandler.Stream,
	)
}
