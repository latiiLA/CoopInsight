package model

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Role struct {
	ID          primitive.ObjectID  `json:"id" bson:"_id,omitempty"`
	Name        string              `json:"name" bson:"name"`
	Permissions []string            `json:"permissions" bson:"permissions"`
	CreatedAt   time.Time           `json:"createdAt" bson:"createdAt"`
	UpdatedAt   time.Time           `json:"updatedAt" bson:"updatedAt"`
	CreatedBy   primitive.ObjectID  `json:"createdBy" bson:"createdBy"`
	Creater     *User               `json:"creater,omitempty" bson:"creater,omitempty"`
	UpdatedBy   *primitive.ObjectID `json:"updatedBy,omitempty" bson:"updatedBy,omitempty"`
	Updater     *User               `json:"updater,omitempty" bson:"updater,omitempty"`
	DeletedBy   *primitive.ObjectID `json:"deletedBy,omitempty" bson:"deletedBy,omitempty"`
	DeletedAt   *time.Time          `json:"deletedAt,omitempty" bson:"deletedAt,omitempty"`
	Status      string              `json:"status" bson:"status"`
}

const (
	RoleStatusActive  = "active"
	RoleStatusDeleted = "deleted"
)

type RoleRepository interface {
	Create(ctx context.Context, role *Role) error
	FindByID(ctx context.Context, role_id primitive.ObjectID) (*Role, error)
	FindAll(ctx context.Context) ([]Role, error)
	FindRoleByName(ctx context.Context, name string) (*Role, error)
	Update(ctx context.Context, role_id primitive.ObjectID, role *Role) error
	Delete(ctx context.Context, role_id primitive.ObjectID, role *Role) error
	FindDeleted(ctx context.Context) ([]Role, error)
}
