package middleware

import (
	"net/http"
	"strings"

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/auth"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/utils"
	"github.com/sirupsen/logrus"
)

func JwtAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		logEntry := utils.GetLogger(c)

		token := bearerToken(c)
		if token == "" {
			logrus.Warn("JWT middleware rejected request")

			c.AbortWithStatusJSON(http.StatusUnauthorized, response.Status{
				Message: "Unauthorized or token expired",
				Error:   "Invalid authorization header",
			})
			return
		}

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
		if userID, ok := claims["userId"].(string); ok {
			c.Set("userID", userID)
		}
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

		claims, ok := toClaimsMap(claimsValue)
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
			if containsPermission(allowedRoles, role) {
				c.Next()
				return
			}
		}

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
			if containsPermission(userPermissions, required) {
				c.Next()
				return
			}
		}

		logrus.WithFields(logrus.Fields{
			"role":     claims["role"],
			"required": requiredPermissions,
			"have":     userPermissions,
		}).Warn("Access denied")

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

func containsPermission(permissions []string, required string) bool {
	for _, permission := range permissions {
		if strings.EqualFold(strings.TrimSpace(permission), strings.TrimSpace(required)) {
			return true
		}
	}

	return false
}

func bearerToken(c *gin.Context) string {
	authHeader := c.GetHeader("Authorization")
	parts := strings.Fields(authHeader)
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		return parts[1]
	}

	if token := strings.TrimSpace(c.Query("token")); token != "" {
		return token
	}

	for _, proto := range strings.Split(c.GetHeader("Sec-WebSocket-Protocol"), ",") {
		proto = strings.TrimSpace(proto)
		if strings.HasPrefix(proto, "jwt.") {
			return strings.TrimPrefix(proto, "jwt.")
		}
	}

	return ""
}

func toClaimsMap(value interface{}) (map[string]interface{}, bool) {
	switch claims := value.(type) {
	case jwt.MapClaims:
		return map[string]interface{}(claims), true
	case map[string]interface{}:
		return claims, true
	default:
		return nil, false
	}
}
