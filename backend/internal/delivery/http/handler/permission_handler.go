package handler

import (
	"errors"
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
	"github.com/sirupsen/logrus"
)

type PermissionHandler interface {
	GetAll(c *gin.Context)
	Create(c *gin.Context)
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
		logrus.WithError(err).Error("failed to fetch permissions")
		c.JSON(http.StatusInternalServerError, response.Status{
			IsSuccessful: false,
			Message:      "Failed to fetch permissions",
			Data:         nil,
		})
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

	err = h.permissionService.Create(c, authUserID, &req)
	if err != nil {
		status := http.StatusInternalServerError
		message := common.MessInternalServerError

		if errors.Is(err, common.ErrPermissionAlreadyExists) {
			status = http.StatusConflict
			message = "Permission already exists"
		}

		logrus.WithError(err).Error("failed to create permission")
		c.JSON(status, response.Status{
			IsSuccessful: false,
			Message:      message,
			Error:        err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, response.Status{
		IsSuccessful: true,
		Message:      "Permission created successfully",
	})
}
