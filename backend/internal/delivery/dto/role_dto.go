package dto

type CreateRoleRequest struct {
	Name        string   `json:"name" binding:"required,min=3,max=50"`
	Permissions []string `json:"permissions" binding:"required,min=1,dive,required"`
}
