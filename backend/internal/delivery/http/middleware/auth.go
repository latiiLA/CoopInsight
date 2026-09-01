package middleware

import (
	"net/http"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/auth"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/utils"
	"github.com/sirupsen/logrus"
)

func JwtAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		logrus.Info("========== JWT MIDDLEWARE HIT ==========")

		logEntry := utils.GetLogger(c)

		authHeader := c.GetHeader("Authorization")

		logrus.WithField("authorization", authHeader).
			Info("Authorization header received")

		parts := strings.Fields(authHeader)

		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			logrus.Warn("JWT middleware rejected request")

			c.AbortWithStatusJSON(http.StatusUnauthorized, response.Status{
				Message: "Unauthorized or token expired",
				Error:   "Invalid authorization header",
			})
			return
		}

		token := parts[1]

		clientIP, err := utils.GetIPAddress(c)
		if err != nil {
			logEntry.WithError(err).Warn("Failed to determine client IP")

			c.AbortWithStatusJSON(http.StatusUnauthorized, response.Status{
				Message: "Unauthorized or token expired",
				Error:   "Unable to determine client IP",
			})
			return
		}

		claims, err := auth.ValidateToken(token, clientIP)
		if err != nil {
			logEntry.WithError(err).Warn("JWT validation failed")

			c.AbortWithStatusJSON(http.StatusUnauthorized, response.Status{
				Message: "Unauthorized or token expired",
				Error:   "Invalid token",
			})
			return
		}

		c.Set("claims", claims)

		logrus.Info("JWT validation successful")

		c.Next()
	}
}

func AuthorizeRolesOrPermissions(allowedRoles []string, requiredPermissions []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		claimsValue, exists := c.Get("claims")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, response.Status{
				Message: "Unauthorized or token expired",
				Error:   "Authentication claims not found",
			})
			return
		}

		claims, ok := claimsValue.(map[string]interface{})
		if !ok {
			c.AbortWithStatusJSON(http.StatusInternalServerError, response.Status{
				Message: "Authorization failed",
				Error:   "Invalid authentication claims",
			})
			return
		}

		// --------------------------------------------------
		// Role authorization
		// --------------------------------------------------

		if role, ok := claims["role"].(string); ok {
			if slices.Contains(allowedRoles, role) {
				c.Next()
				return
			}
		}

		// --------------------------------------------------
		// Permission authorization
		// --------------------------------------------------

		permissions, exists := claims["permissions"]
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, response.Status{
				Message: "Access denied",
				Error:   "Permissions not found",
			})
			return
		}

		userPermissions := extractPermissions(permissions)

		for _, required := range requiredPermissions {
			if slices.Contains(userPermissions, required) {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, response.Status{
			Message: "Access denied",
			Error:   "Insufficient permissions",
		})
	}
}

func extractPermissions(value interface{}) []string {
	switch permissions := value.(type) {
	case []string:
		return permissions

	case []interface{}:
		result := make([]string, 0, len(permissions))

		for _, permission := range permissions {
			if value, ok := permission.(string); ok {
				result = append(result, value)
			}
		}

		return result

	default:
		return nil
	}
}
