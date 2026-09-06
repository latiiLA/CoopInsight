package dto

import (
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type UpdateAvatarRequest struct {
	Avatar string `json:"avatar"`
}

type UpdateProfileRequest struct {
	JobTitle   string `json:"jobTitle" binding:"max=80"`
	Department string `json:"department" binding:"max=80"`
	Branch     string `json:"branch" binding:"max=80"`
	Phone      string `json:"phone" binding:"max=30"`
	Bio        string `json:"bio" binding:"max=500"`
}

type UpdateUserRequest struct {
	FirstName   string   `json:"firstName" binding:"required,min=3,max=50"`
	MiddleName  string   `json:"middleName" binding:"required,min=3,max=50"`
	LastName    string   `json:"lastName" binding:"required,min=3,max=50"`
	Email       string   `json:"email" binding:"required,email"`
	Role        string   `json:"role" binding:"required"`
	Permissions []string `json:"permissions"`
	Status      string   `json:"status" binding:"required,oneof=new active inactive suspended deactivated"`
}

type UserResponse struct {
	ID          primitive.ObjectID `json:"id" bson:"_id,omitempty"`
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
