package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PermissionStatus string

const (
	PermissionStatusActive  PermissionStatus = "active"
	PermissionStatusDeleted PermissionStatus = "deleted"
)

type Permission struct {
	ID          primitive.ObjectID  `json:"id" bson:"_id,omitempty"`
	Name        string              `json:"name" bson:"name"`
	Resource    string              `json:"resource" bson:"resource"`
	Action      string              `json:"action" bson:"action"`
	Description string              `json:"description,omitempty" bson:"description,omitempty"`
	Status      PermissionStatus    `json:"status" bson:"status"`
	CreatedAt   time.Time           `json:"createdAt" bson:"createdAt"`
	UpdatedAt   time.Time           `json:"updatedAt" bson:"updatedAt"`
	CreatedBy   primitive.ObjectID  `json:"createdBy" bson:"createdBy"`
	Creator     *User               `json:"creator,omitempty" bson:"creator,omitempty"`
	UpdatedBy   *primitive.ObjectID `json:"updatedBy,omitempty" bson:"updatedBy,omitempty"`
	Updater     *User               `json:"updater,omitempty" bson:"updater,omitempty"`
	DeletedBy   *primitive.ObjectID `json:"deletedBy,omitempty" bson:"deletedBy,omitempty"`
	DeletedAt   *time.Time          `json:"deletedAt,omitempty" bson:"deletedAt,omitempty"`
	Assigned    bool                `json:"assigned" bson:"-"`
}
