package dto

import (
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type LoginRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50,alphanum"`
	Password string `json:"password" binding:"required,min=6,max=50"`
}

type RegisterRequest struct {
	Username    string   `json:"username" binding:"required,min=2,max=50"`
	FirstName   string   `json:"firstName" binding:"required,min=3,max=50"`
	MiddleName  string   `json:"middleName" binding:"required,min=3,max=50"`
	LastName    string   `json:"lastName" binding:"required,min=3,max=50"`
	Email       string   `json:"email" binding:"required,email"`
	Role        string   `json:"role" binding:"required"`
	Permissions []string `json:"permissions"`
}

type LoginResponse struct {
	User         model.User `json:"user"`
	Email        string     `json:"email"`
	Token        string     `json:"token"`
	RefreshToken string     `json:"refreshToken"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}
