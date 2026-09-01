package middleware

import (
	"bytes"
	"encoding/json"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/utils"
	"github.com/sirupsen/logrus"
)

const TraceIDKey = "TraceID"

// responseWriter captures the response body while still
// writing it to the original Gin response writer.
type responseWriter struct {
	gin.ResponseWriter
	body bytes.Buffer
}

func (w *responseWriter) Write(data []byte) (int, error) {
	w.body.Write(data)
	return w.ResponseWriter.Write(data)
}

func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Resolve route path.
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}

		// Get existing trace ID or generate a new one.
		traceID := c.GetHeader("X-Trace-ID")
		if traceID == "" {
			traceID = uuid.NewString()
		}

		// Store TraceID in Gin context.
		c.Set(TraceIDKey, traceID)

		// Return TraceID to the client.
		c.Header("X-Trace-ID", traceID)

		// Wrap the response writer so we can capture
		// the response body for logging.
		writer := &responseWriter{
			ResponseWriter: c.Writer,
		}

		c.Writer = writer

		// Continue request processing.
		c.Next()

		// Request completed.
		latency := time.Since(start)
		status := c.Writer.Status()

		// Get authenticated user, if available.
		userID := "anonymous"

		if id, err := utils.GetUserID(c); err == nil {
			userID = id.Hex()
		}

		fields := logrus.Fields{
			"trace_id":    traceID,
			"user_id":     userID,
			"method":      c.Request.Method,
			"path":        path,
			"status":      status,
			"status_text": statusText(status),
			"latency_ms":  latency.Milliseconds(),
			"ip":          c.ClientIP(),
			"user_agent":  c.Request.UserAgent(),
			"bytes":       writer.body.Len(),
		}

		// Extract message and error from the standard API response.
		if writer.body.Len() > 0 {
			var responseBody response.Status

			if err := json.Unmarshal(writer.body.Bytes(), &responseBody); err == nil {
				if responseBody.Message != "" {
					fields["message"] = responseBody.Message
				}

				if responseBody.Error != "" {
					fields["error"] = responseBody.Error
				}
			}
		}

		entry := logrus.WithFields(fields)

		switch {
		case status >= 500:
			entry.Error("HTTP request completed")

		case status >= 400:
			entry.Warn("HTTP request completed")

		default:
			entry.Info("HTTP request completed")
		}
	}
}

func statusText(status int) string {
	switch {
	case status >= 500:
		return "server_error"
	case status >= 400:
		return "client_error"
	case status >= 300:
		return "redirect"
	case status >= 200:
		return "success"
	default:
		return "informational"
	}
}
