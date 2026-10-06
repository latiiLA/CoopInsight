package router

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/configs"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
)

// A dashboard with a few embed panels on a 30s refresh stays well under this;
// anything above it is a loop or abuse.
const (
	embedRateLimit  = 120
	embedRateWindow = time.Minute
)

// embedTimeout falls back to the Oracle timeout when unset, since every embed
// route runs an Oracle aggregate that can exceed the short default.
func embedTimeout() time.Duration {
	if configs.EmbedAPITimeout > 0 {
		return configs.EmbedAPITimeout
	}
	return configs.OracleTimeout
}

// registerEmbedRoutes exposes the read-only reporting surface that Grafana
// widgets embed.
//
// Deliberately a separate group from `protected`: these callers have no user
// session, so they are gated on a shared API key instead of JWT plus
// permissions. That is a weaker guarantee — see EmbedAuthMiddleware — and is
// why only aggregate reporting is exposed here.
func registerEmbedRoutes(
	api *gin.RouterGroup,
	successRate handler.EmbedSuccessRateHandler,
	cardActivity handler.EmbedCardActivityHandler,
) {
	embed := api.Group("/embed")
	embed.Use(
		middleware.EmbedRateLimit(embedRateLimit, embedRateWindow),
		middleware.EmbedAuthMiddleware(),
		middleware.Timeout(embedTimeout()),
	)

	if successRate != nil {
		embed.GET("/switch/overall-success-rate", successRate.GetSwitchOverall)
		embed.GET("/switch/onus-success-rate", successRate.GetSwitchOnus)
		embed.GET("/switch/offus-success-rate", successRate.GetSwitchOffus)
		embed.GET("/switch/issuing-success-rate", successRate.GetSwitchIssuing)
	}

	// Aggregates only; /card/details (individual cards) is never embedded.
	if cardActivity != nil {
		embed.GET("/card/activity", cardActivity.Activity)
		embed.GET("/card/activity/by-branch", cardActivity.ActivityByBranch)
		embed.GET("/card/activity/branch-trend", cardActivity.BranchTrend)
	}
}
