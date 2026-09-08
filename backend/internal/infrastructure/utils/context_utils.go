package utils

import (
	"context"
	"errors"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type contextKey string

const (
	CtxKeyIP      contextKey = "activity_ip"
	CtxKeyUA      contextKey = "activity_user_agent"
	CtxKeyTraceID contextKey = "activity_trace_id"
)

func GetUserID(c *gin.Context) (primitive.ObjectID, error) {
	val, exists := c.Get("userID")
	if !exists {
		return primitive.NilObjectID, errors.New("user ID not found in context")
	}

	userIDStr, ok := val.(string)
	if !ok {
		return primitive.NilObjectID, errors.New("user ID is not a valid string")
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return primitive.NilObjectID, errors.New("invalid ObjectID format")
	}

	return userID, nil
}

func GetIPAddress(c *gin.Context) (string, error) {
	ip := c.ClientIP()

	if ip == "" {
		return "", errors.New("IP not found")
	}

	return ip, nil
}

// RequestMeta pulls IP / user-agent / trace id from a gin context or request context.
func RequestMeta(ctx context.Context) (ip, userAgent, traceID string) {
	if gc, ok := ctx.(*gin.Context); ok {
		return gc.ClientIP(), gc.Request.UserAgent(), gc.GetString("TraceID")
	}

	if v := ctx.Value(CtxKeyIP); v != nil {
		if s, ok := v.(string); ok {
			ip = s
		}
	}
	if v := ctx.Value(CtxKeyUA); v != nil {
		if s, ok := v.(string); ok {
			userAgent = s
		}
	}
	if v := ctx.Value(CtxKeyTraceID); v != nil {
		if s, ok := v.(string); ok {
			traceID = s
		}
	}
	return ip, userAgent, traceID
}

// WithRequestMeta attaches request metadata for services that receive c.Request.Context().
func WithRequestMeta(parent context.Context, ip, userAgent, traceID string) context.Context {
	ctx := context.WithValue(parent, CtxKeyIP, ip)
	ctx = context.WithValue(ctx, CtxKeyUA, userAgent)
	ctx = context.WithValue(ctx, CtxKeyTraceID, traceID)
	return ctx
}
