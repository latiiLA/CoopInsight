package dto

import (
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

type LoginRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50,alphanum"`
	Password string `json:"password" binding:"required,min=6,max=50"`
}

type LoginResponse struct {
	User         model.User `json:"user"`
	Email        string     `json:"email"`
	Token        string     `json:"token"`
	RefreshToken string     `json:"refreshToken"`
}
