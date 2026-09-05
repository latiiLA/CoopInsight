package handler

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/dto"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/utils"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type PermissionHandler interface {
	GetAll(c *gin.Context)
	GetByID(c *gin.Context)
	Create(c *gin.Context)
	Update(c *gin.Context)
	Delete(c *gin.Context)
}

type permissionHandler struct {
	permissionService service.PermissionService
}

func NewPermissionHandler(permissionService service.PermissionService) PermissionHandler {
	return &permissionHandler{
		permissionService: permissionService,
	}
}

func (h *permissionHandler) GetAll(c *gin.Context) {
	permissions, err := h.permissionService.GetAll(c)
	if err != nil {
		writeAppError(c, err)
		return
	}

	if permissions == nil {
		permissions = []model.Permission{}
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Permissions fetched successfully",
		Data:         permissions,
	})
}

func (h *permissionHandler) GetByID(c *gin.Context) {
	permissionID, ok := parseObjectIDParam(c, "id")
	if !ok {
		return
	}

	permission, err := h.permissionService.GetByID(c, permissionID)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Permission fetched successfully",
		Data:         permission,
	})
}

func (h *permissionHandler) Create(c *gin.Context) {
	authUserID, err := utils.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, response.Status{
			IsSuccessful: false,
			Message:      common.MessUnauthorized,
			Error:        err.Error(),
		})
		return
	}

	var req dto.CreatePermissionRequest
	if !bindPermissionRequest(c, &req) {
		return
	}

	err = h.permissionService.Create(c, authUserID, &req)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusCreated, response.Status{
		IsSuccessful: true,
		Message:      "Permission created successfully",
	})
}

func (h *permissionHandler) Update(c *gin.Context) {
	authUserID, err := utils.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, response.Status{
			IsSuccessful: false,
			Message:      common.MessUnauthorized,
			Error:        err.Error(),
		})
		return
	}

	permissionID, ok := parseObjectIDParam(c, "id")
	if !ok {
		return
	}

	var req dto.UpdatePermissionRequest
	if !bindPermissionRequest(c, &req) {
		return
	}

	err = h.permissionService.Update(c, authUserID, permissionID, &req)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Permission updated successfully",
	})
}

func (h *permissionHandler) Delete(c *gin.Context) {
	authUserID, err := utils.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, response.Status{
			IsSuccessful: false,
			Message:      common.MessUnauthorized,
			Error:        err.Error(),
		})
		return
	}

	permissionID, ok := parseObjectIDParam(c, "id")
	if !ok {
		return
	}

	err = h.permissionService.Delete(c, authUserID, permissionID)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Permission deleted successfully",
	})
}

func bindPermissionRequest(c *gin.Context, req any) bool {
	if err := c.ShouldBindJSON(req); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			e := validationErrors[0]
			message := fmt.Sprintf(
				"%s failed on %s validation",
				e.Field(),
				e.Tag(),
			)

			c.JSON(http.StatusBadRequest, response.Status{
				Message: message,
				Error:   err.Error(),
			})
			return false
		}

		c.JSON(http.StatusBadRequest, response.Status{
			Message: common.MessInvalidRequest,
			Error:   err.Error(),
		})
		return false
	}

	return true
}
