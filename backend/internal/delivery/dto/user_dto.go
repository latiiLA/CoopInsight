package dto

import "go.mongodb.org/mongo-driver/bson/primitive"

type LoginRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50,alphanum"`
	Password string `json:"password" binding:"required,min=6,max=50"`
}

type LoginResponse struct {
	ID           primitive.ObjectID  `json:"_id" bson:"_id,omitempty"`
	FirstName    string              `json:"first_name" bson:"first_name"`
	MiddleName   string              `json:"middle_name" bson:"middle_name"`
	Role         string              `json:"role" bson:"role"`
	Permissions  []string            `json:"permissions" bson:"permissions"`
	Username     string              `json:"username" bson:"username"`
	Email        string              `json:"email" bson:"email"`
	DepartmentID *primitive.ObjectID `json:"department_id,omitempty" bson:"department_id,omitempty"`
	BranchID     *primitive.ObjectID `json:"branch_id,omitempty" bson:"branch_id,omitempty"`
	Signature    *string             `json:"signature,omitempty" bson:"signature,omitempty"`
	Token        string              `json:"token" bson:"-"`
	RefreshToken string              `json:"refresh_token" bson:"-"`
}
