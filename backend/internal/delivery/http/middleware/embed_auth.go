package middleware

import (
	"crypto/sha256"
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/configs"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
)

// EmbedAuthMiddleware guards the read-only /api/embed surface used by Grafana
// widgets, which have no user session to present.
//
// This is a shared secret, not a user credential: every embed client holds the
// same key, so it cannot express per-user permissions or produce an audit trail
// of who viewed what. It is therefore only appropriate for aggregate reporting
// on internal dashboards. Anything exposing per-user or PII-bearing data must
// stay behind JwtAuthMiddleware.
//
// The key is accepted only from the X-Api-Key header. A query-string key would
// be written verbatim to gin and nginx access logs.
//
// A blank configured key rejects everything, so a missing EMBED_API_KEY fails
// closed rather than defaulting to open.
func EmbedAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		expected := strings.TrimSpace(configs.EmbedAPIKey)
		if expected == "" {
			c.AbortWithStatusJSON(http.StatusNotFound, response.Status{
				Message: "Not found",
				Error:   "Embed API is not configured",
			})
			return
		}

		presented := strings.TrimSpace(c.GetHeader("X-Api-Key"))

		// Constant-time compare: a plain == short-circuits on the first differing
		// byte, which lets an attacker recover the key one byte at a time by
		// timing responses.
		//
		// Both sides are hashed first because ConstantTimeCompare returns 0
		// immediately on a length mismatch, which would otherwise leak the key's
		// length. sha256 makes them the same fixed 32 bytes regardless.
		expectedSum := sha256.Sum256([]byte(expected))
		presentedSum := sha256.Sum256([]byte(presented))
		if subtle.ConstantTimeCompare(presentedSum[:], expectedSum[:]) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, response.Status{
				Message: "Unauthorized",
				Error:   "Invalid or missing embed API key",
			})
			return
		}

		c.Next()
	}
}
