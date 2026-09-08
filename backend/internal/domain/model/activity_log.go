package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	ActivityStatusSuccess = "success"
	ActivityStatusFailure = "failure"

	ActivityAuthLoginSuccess       = "auth.login.success"
	ActivityAuthLoginFailure       = "auth.login.failure"
	ActivityUserCreate             = "user.create"
	ActivityUserUpdate             = "user.update"
	ActivityUserDelete             = "user.delete"
	ActivityRoleCreate             = "role.create"
	ActivityRoleUpdate             = "role.update"
	ActivityRoleDelete             = "role.delete"
	ActivityPermissionCreate       = "permission.create"
	ActivityPermissionUpdate       = "permission.update"
	ActivityPermissionDelete       = "permission.delete"
	ActivityAccountRequestCreate   = "account_request.create"
	ActivityAccountRequestFulfill  = "account_request.fulfill"
	ActivitySwitchCommandRun       = "switch.command.run"
)

type ActivityLog struct {
	ID             primitive.ObjectID     `json:"id" bson:"_id,omitempty"`
	Timestamp      time.Time              `json:"timestamp" bson:"timestamp"`
	ActorUserID    *primitive.ObjectID    `json:"actorUserId,omitempty" bson:"actorUserId,omitempty"`
	ActorUsername  string                 `json:"actorUsername" bson:"actorUsername"`
	Action         string                 `json:"action" bson:"action"`
	ResourceType   string                 `json:"resourceType,omitempty" bson:"resourceType,omitempty"`
	ResourceID     string                 `json:"resourceId,omitempty" bson:"resourceId,omitempty"`
	Summary        string                 `json:"summary" bson:"summary"`
	Status         string                 `json:"status" bson:"status"`
	IP             string                 `json:"ip,omitempty" bson:"ip,omitempty"`
	UserAgent      string                 `json:"userAgent,omitempty" bson:"userAgent,omitempty"`
	TraceID        string                 `json:"traceId,omitempty" bson:"traceId,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty" bson:"metadata,omitempty"`
}

type ActivityLogFilter struct {
	From     time.Time
	To       time.Time
	Actor    string
	Action   string
	Query    string
	Page     int
	PageSize int
}

type ActivityLogListResult struct {
	Items    []ActivityLog `json:"items"`
	Total    int64         `json:"total"`
	Page     int           `json:"page"`
	PageSize int           `json:"pageSize"`
}
