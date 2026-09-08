package router

import (
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/configs"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
	"github.com/sirupsen/logrus"
)

type Handlers struct {
	User                       handler.UserHandler
	Permission                 handler.PermissionHandler
	Role                       handler.RoleHandler
	Test                       handler.TestHandler
	SuccessTransaction         handler.SuccessTransactionHandler
	EbirrCardlessWithdrawal    handler.EbirrCardlessWithdrawalHandler
	TerminalTransaction        handler.TerminalTransactionHandler
	AtmTerminal                handler.AtmTerminalHandler
	PosTerminal                handler.PosTerminalHandler
	OnusMonitoring             handler.OnusMonitoringHandler
	OffusMonitoring            handler.OnusMonitoringHandler
	MastercardDebitMonitoring  handler.OnusMonitoringHandler
	MastercardCreditMonitoring handler.OnusMonitoringHandler
	VisaMonitoring             handler.OnusMonitoringHandler
	SwitchCommand              handler.SwitchCommandHandler
}

func SetupRouter(handlers Handlers) *gin.Engine {
	router := gin.New()

	// --------------------------------------------------
	// Middleware
	// --------------------------------------------------

	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	allowed := configs.AllowedOrigins

	corsConfig := cors.Config{
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowHeaders: []string{
			"Origin",
			"Content-Type",
			"Authorization",
			"Content-Disposition",
		},
		AllowCredentials: true,
	}

	if len(allowed) == 0 || (len(allowed) == 1 && allowed[0] == "*") {
		logrus.Warn("AllowedOrigins is empty or wildcard. Allowing localhost origins.")
		corsConfig.AllowOriginFunc = func(origin string) bool {
			return strings.HasPrefix(origin, "http://localhost:") ||
				strings.HasPrefix(origin, "http://127.0.0.1:")
		}
	} else {
		corsConfig.AllowOrigins = allowed
	}

	router.Use(cors.New(corsConfig))

	router.Use(middleware.RequestLogger())

	// Only trust localhost
	if err := router.SetTrustedProxies([]string{"127.0.0.1", "::1"}); err != nil {
		logrus.Fatal("Failed to configure trusted proxies:", err)
	}

	router.ForwardedByClientIP = true

	// --------------------------------------------------
	// Static files
	// --------------------------------------------------

	router.Static("/uploads", configs.FileUploadPath)

	// Health check
	router.GET("/health", func(c *gin.Context) {
		oracleStatus := "disabled"
		if configs.OracleEnabled {
			if configs.OracleConnected {
				oracleStatus = "up"
			} else {
				oracleStatus = "down"
			}
		}

		sourceMongoStatus := "disabled"
		if configs.SourceMongoEnabled {
			if configs.SourceMongoConnected {
				sourceMongoStatus = "up"
			} else {
				sourceMongoStatus = "down"
			}
		}

		c.JSON(200, gin.H{
			"status":      "ok",
			"mongo":       "up",
			"oracle":      oracleStatus,
			"sourceMongo": sourceMongoStatus,
		})
	})

	api := router.Group("/api")

	// --------------------------------------------------
	// Public routes
	// --------------------------------------------------

	registerAuthRoutes(api, handlers.User)

	// --------------------------------------------------
	// Protected routes - default timeout
	// --------------------------------------------------

	protected := api.Group("")
	protected.Use(
		middleware.JwtAuthMiddleware(),
		middleware.Timeout(configs.Timeout),
	)

	registerUserRoutes(protected, handlers.User)
	registerAccountRequestRoutes(protected, handlers.User)
	registerAccountRoutes(protected, handlers.User)
	registerPermissionRoutes(protected, handlers.Permission)
	registerRoleRoutes(protected, handlers.Role)
	registerAtmTerminalRoutes(protected, handlers.AtmTerminal)
	registerPosTerminalRoutes(protected, handlers.PosTerminal)

	// --------------------------------------------------
	// Protected Oracle routes - longer timeout
	// --------------------------------------------------

	oracleProtected := api.Group("")
	oracleProtected.Use(
		middleware.JwtAuthMiddleware(),
		middleware.Timeout(configs.OracleTimeout),
	)

	registerTestRoutes(oracleProtected, handlers.Test)
	registerReportRoutes(
		oracleProtected,
		handlers.SuccessTransaction,
		handlers.EbirrCardlessWithdrawal,
		handlers.TerminalTransaction,
	)

	live := api.Group("")
	live.Use(middleware.JwtAuthMiddleware())
	registerMonitoringRoutes(
		live,
		handlers.OnusMonitoring,
		handlers.OffusMonitoring,
		handlers.MastercardDebitMonitoring,
		handlers.MastercardCreditMonitoring,
		handlers.VisaMonitoring,
		handlers.SwitchCommand,
	)

	return router
}
