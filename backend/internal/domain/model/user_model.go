package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type UserStatus string

const (
	StatusNew         UserStatus = "new"
	StatusActive      UserStatus = "active"
	StatusInactive    UserStatus = "inactive"
	StatusSuspended   UserStatus = "suspended"
	StatusDeactivated UserStatus = "deactivated"
	StatusDeleted     UserStatus = "deleted"
)

type User struct {
	ID          primitive.ObjectID  `json:"id" bson:"_id,omitempty"`
	FirstName   string              `json:"firstName" bson:"firstName,omitempty"`
	MiddleName  string              `json:"middleName" bson:"middleName,omitempty"`
	LastName    string              `json:"lastName" bson:"lastName,omitempty"`
	Email       string              `json:"email" bson:"email"`
	RoleID      primitive.ObjectID  `json:"roleId,omitempty" bson:"roleId,omitempty"`
	Role        *Role               `json:"role,omitempty" bson:"role,omitempty"`
	Permissions []string            `json:"permissions,omitempty" bson:"permissions,omitempty"`
	Username    string              `json:"username" bson:"username"`
	Password    string              `json:"-" bson:"password,omitempty"`
	Avatar      string              `json:"avatar,omitempty" bson:"avatar,omitempty"`
	Profile     UserProfile         `json:"profile,omitempty" bson:"profile,omitempty"`
	Status      UserStatus          `json:"status" bson:"status"`
	LastLogin   *time.Time          `json:"lastLogin,omitempty" bson:"lastLogin,omitempty"`
	CreatedAt   time.Time           `json:"createdAt" bson:"createdAt"`
	UpdatedAt   time.Time           `json:"updatedAt" bson:"updatedAt"`
	CreatedBy   primitive.ObjectID  `json:"createdBy" bson:"createdBy"`
	Creator     *User               `json:"creator,omitempty" bson:"creator,omitempty"`
	Updater     *User               `json:"updater,omitempty" bson:"updater,omitempty"`
	UpdatedBy   *primitive.ObjectID `json:"updatedBy,omitempty" bson:"updatedBy,omitempty"`
	DeletedBy   *primitive.ObjectID `json:"deletedBy,omitempty" bson:"deletedBy,omitempty"`
	DeletedAt   *time.Time          `json:"deletedAt,omitempty" bson:"deletedAt,omitempty"`
}

func (u *User) HasAssignedRole() bool {
	if u == nil {
		return false
	}

	if !u.RoleID.IsZero() {
		return true
	}

	return u.Role != nil && !u.Role.ID.IsZero()
}

type UserProfile struct {
	JobTitle   string `json:"jobTitle,omitempty" bson:"jobTitle,omitempty"`
	Department string `json:"department,omitempty" bson:"department,omitempty"`
	Branch     string `json:"branch,omitempty" bson:"branch,omitempty"`
	Phone      string `json:"phone,omitempty" bson:"phone,omitempty"`
	Bio        string `json:"bio,omitempty" bson:"bio,omitempty"`
}
