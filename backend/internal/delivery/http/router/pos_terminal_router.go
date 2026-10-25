package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

func registerPosTerminalRoutes(protected *gin.RouterGroup, posTerminalHandler handler.PosTerminalHandler) {
	terminals := protected.Group("/terminals")

	terminals.GET(
		"/pos",
		middleware.AuthorizeRolesOrPermissions(
			[]string{"SUPERADMIN"},
			[]string{
				"terminal:view-pos",
				"terminal:view-pos-transaction",
				// Recon export pickers need the full TMS POS list.
				"report:export-switch-terminal-recon",
				"report:export-cortex-terminal-recon",
			},
		),
		posTerminalHandler.GetAll,
	)
}
