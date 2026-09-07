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

type RoleHandler interface {
	GetAll(c *gin.Context)
	GetByID(c *gin.Context)
	Create(c *gin.Context)
	Update(c *gin.Context)
	Delete(c *gin.Context)
}

type roleHandler struct {
	roleService service.RoleService
}

func NewRoleHandler(roleService service.RoleService) RoleHandler {
	return &roleHandler{
		roleService: roleService,
	}
}

func (h *roleHandler) GetAll(c *gin.Context) {
	roles, err := h.roleService.GetAll(c)
	if err != nil {
		writeAppError(c, err)
		return
	}

	if roles == nil {
		roles = []model.Role{}
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Roles fetched successfully",
		Data:         roles,
	})
}

func (h *roleHandler) GetByID(c *gin.Context) {
	roleID, ok := parseObjectIDParam(c, "id")
	if !ok {
		return
	}

	role, err := h.roleService.GetByID(c, roleID)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Role fetched successfully",
		Data:         role,
	})
}

func (h *roleHandler) Create(c *gin.Context) {
	authUserID, err := utils.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, response.Status{
			IsSuccessful: false,
			Message:      common.MessUnauthorized,
			Error:        err.Error(),
		})
		return
	}

	var req dto.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
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
			return
		}

		c.JSON(http.StatusBadRequest, response.Status{
			Message: common.MessInvalidRequest,
			Error:   err.Error(),
		})
		return
	}

	err = h.roleService.Create(c, authUserID, &req)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusCreated, response.Status{
		IsSuccessful: true,
		Message:      "Role created successfully",
	})
}

func (h *roleHandler) Update(c *gin.Context) {
	roleID, ok := parseObjectIDParam(c, "id")
	if !ok {
		return
	}

	authUserID, err := utils.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, response.Status{
			IsSuccessful: false,
			Message:      common.MessUnauthorized,
			Error:        err.Error(),
		})
		return
	}

	var req dto.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
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
			return
		}

		c.JSON(http.StatusBadRequest, response.Status{
			Message: common.MessInvalidRequest,
			Error:   err.Error(),
		})
		return
	}

	err = h.roleService.Update(c, authUserID, roleID, &req)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Role updated successfully",
	})
}

func (h *roleHandler) Delete(c *gin.Context) {
	authUserID, err := utils.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, response.Status{
			IsSuccessful: false,
			Message:      common.MessUnauthorized,
			Error:        err.Error(),
		})
		return
	}

	roleID, ok := parseObjectIDParam(c, "id")
	if !ok {
		return
	}

	err = h.roleService.Delete(c, authUserID, roleID)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Role deleted successfully",
	})
}
