package dto

import (
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type UserResponse struct {
	ID          primitive.ObjectID `json:"_id" bson:"_id,omitempty"`
	Role        model.Role         `json:"role" bson:"role"`
	Permissions []string           `json:"permissions,omitempty" bson:"permissions,omitempty"`
	Username    string             `json:"username" bson:"username"`
	Email       string             `json:"email" bson:"email"`
	FirstName   string             `json:"firstName" bson:"firstName"`
	MiddleName  string             `json:"middleName" bson:"middleName"`
	LastName    string             `json:"lastName" bson:"lastName"`
	Status      string             `json:"status" bson:"status"`
	CreatedAt   time.Time          `json:"createdAt"`
	UpdatedAt   time.Time          `json:"updatedAt"`
	CreatedBy   string             `json:"createdBy"`
	Creator     *model.User        `json:"creator,omitempty"`
	Updater     *model.User        `json:"updater,omitempty"`
	UpdatedBy   *string            `json:"updatedBy,omitempty"`
	DeletedBy   *string            `json:"deletedBy,omitempty"`
	DeletedAt   *time.Time         `json:"deletedAt,omitempty"`
}
