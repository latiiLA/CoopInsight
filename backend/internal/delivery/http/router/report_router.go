package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerReportRoutes(
	protected *gin.RouterGroup,
	successTransactionHandler handler.SuccessTransactionHandler,
	ebirrCardlessHandler handler.EbirrCardlessWithdrawalHandler,
	terminalTransactionHandler handler.TerminalTransactionHandler,
) {
	reports := protected.Group("/reports")

	reports.GET(
		"/success-transactions",
		middleware.AuthorizeRolesOrPermissions([]string{}, []string{"report:view-success-transactions"}),
		successTransactionHandler.GetReport,
	)
	reports.GET(
		"/ebirr-cardless-withdrawal",
		middleware.AuthorizeRolesOrPermissions([]string{}, []string{"report:view-ebirr-cardless-withdrawal"}),
		ebirrCardlessHandler.GetReport,
	)
	reports.GET(
		"/atm-transactions",
		middleware.AuthorizeRolesOrPermissions(
			[]string{"SUPERADMIN"},
			[]string{"terminal:view-atm-transaction"},
		),
		terminalTransactionHandler.GetByTerminal,
	)
	reports.GET(
		"/pos-transactions",
		middleware.AuthorizeRolesOrPermissions(
			[]string{"SUPERADMIN"},
			[]string{"terminal:view-pos-transaction"},
		),
		terminalTransactionHandler.GetByTerminal,
	)
	reports.GET(
		"/atm-terminal-comparison",
		middleware.AuthorizeRolesOrPermissions(
			[]string{"SUPERADMIN"},
			[]string{"terminal:view-atm-transaction"},
		),
		terminalTransactionHandler.GetAtmComparison,
	)
	reports.GET(
		"/pos-terminal-comparison",
		middleware.AuthorizeRolesOrPermissions(
			[]string{"SUPERADMIN"},
			[]string{"terminal:view-pos-transaction"},
		),
		terminalTransactionHandler.GetPosComparison,
	)
}
