package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type AccountRequestStatus string

const (
	AccountRequestPending   AccountRequestStatus = "pending"
	AccountRequestFulfilled AccountRequestStatus = "fulfilled"
)

type AccountRequest struct {
	ID              primitive.ObjectID   `json:"id" bson:"_id,omitempty"`
	Username        string               `json:"username" bson:"username"`
	FirstName       string               `json:"firstName" bson:"firstName"`
	MiddleName      string               `json:"middleName" bson:"middleName"`
	LastName        string               `json:"lastName" bson:"lastName"`
	Email           string               `json:"email" bson:"email"`
	Status          AccountRequestStatus `json:"status" bson:"status"`
	CreatedAt       time.Time            `json:"createdAt" bson:"createdAt"`
	UpdatedAt       time.Time            `json:"updatedAt" bson:"updatedAt"`
	FulfilledBy     *primitive.ObjectID  `json:"fulfilledBy,omitempty" bson:"fulfilledBy,omitempty"`
	FulfilledUserID *primitive.ObjectID  `json:"fulfilledUserId,omitempty" bson:"fulfilledUserId,omitempty"`
}
