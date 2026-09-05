package dto

type CreatePermissionRequest struct {
	Name        string `json:"name" binding:"required,min=3,max=80"`
	Resource    string `json:"resource" binding:"required,min=2,max=50"`
	Action      string `json:"action" binding:"required,min=2,max=50"`
	Description string `json:"description"`
}
