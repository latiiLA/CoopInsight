package utils

import (
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

// GetLogger returns a logrus Entry containing common request metadata.
func GetLogger(c *gin.Context) *log.Entry {
	traceID := c.GetString("TraceID")
	if traceID == "" {
		traceID = "unknown"
	}

	userID := "anonymous"

	if uid, err := GetUserID(c); err == nil {
		userID = uid.Hex()
	}

	return log.WithFields(log.Fields{
		"trace_id":   traceID,
		"user_id":    userID,
		"ip":         c.ClientIP(),
		"user_agent": c.Request.UserAgent(),
	})
}
