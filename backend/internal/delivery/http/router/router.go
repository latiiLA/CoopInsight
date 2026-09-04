package router

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/configs"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/middleware"
	"github.com/sirupsen/logrus"
)

type Handlers struct {
	User       handler.UserHandler
	Permission handler.PermissionHandler
	Test       handler.TestHandler
}

func SetupRouter(handlers Handlers) *gin.Engine {
	router := gin.New()

	// --------------------------------------------------
	// Middleware
	// --------------------------------------------------

	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	allowed := configs.AllowedOrigins

	if len(allowed) == 0 {
		logrus.Warn("AllowedOrigins is empty. Falling back to '*'")
		allowed = []string{"*"}
	}

	router.Use(cors.New(cors.Config{
		AllowOrigins: allowed,
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowHeaders: []string{
			"Origin",
			"Content-Type",
			"Authorization",
			"Content-Disposition",
		},
		AllowCredentials: true,
	}))

	router.Use(middleware.RequestLogger())

	// Only trust localhost
	if err := router.SetTrustedProxies([]string{"127.0.0.1", "::1"}); err != nil {
		logrus.Fatal("Failed to configure trusted proxies:", err)
	}

	router.ForwardedByClientIP = true

	// --------------------------------------------------
	// Static files
	// --------------------------------------------------

	router.Static("/uploads", "./uploads")

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
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
	registerPermissionRoutes(protected, handlers.Permission)

	// --------------------------------------------------
	// Protected Oracle routes - longer timeout
	// --------------------------------------------------

	oracleProtected := api.Group("")
	oracleProtected.Use(
		middleware.JwtAuthMiddleware(),
		middleware.Timeout(configs.OracleTimeout),
	)

	registerTestRoutes(oracleProtected, handlers.Test)
	return router
}
