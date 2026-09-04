package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
	"github.com/sirupsen/logrus"
)

type PermissionHandler interface {
	GetAll(c *gin.Context)
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
