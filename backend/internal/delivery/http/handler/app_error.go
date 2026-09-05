package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/sirupsen/logrus"
)

var appErrors = []struct {
	err    error
	status int
}{
	{common.ErrInvalidCredentials, http.StatusUnauthorized},
	{common.ErrUserAccessRevoked, http.StatusUnauthorized},
	{common.ErrUnauthorized, http.StatusUnauthorized},
	{common.ErrADUserNotFound, http.StatusForbidden},
	{common.ErrUserNotFound, http.StatusNotFound},
	{common.ErrRoleNotFound, http.StatusNotFound},
	{common.ErrPermissionNotFound, http.StatusNotFound},
	{common.ErrUsernameAlreadyExists, http.StatusConflict},
	{common.ErrRoleNameAlreadyExists, http.StatusConflict},
	{common.ErrRoleNameNotAllowed, http.StatusBadRequest},
	{common.ErrPermissionAlreadyExists, http.StatusConflict},
	{common.ErrFailedToFetchUser, http.StatusInternalServerError},
	{common.ErrFailedToFetchUsers, http.StatusInternalServerError},
	{common.ErrFailedToCreateUser, http.StatusInternalServerError},
	{common.ErrFailedToUpdateUser, http.StatusInternalServerError},
	{common.ErrFailedToDecodeUser, http.StatusInternalServerError},
	{common.ErrFailedToFetchRole, http.StatusInternalServerError},
	{common.ErrFailedToFetchRoles, http.StatusInternalServerError},
	{common.ErrFailedToCreateRole, http.StatusInternalServerError},
	{common.ErrFailedToUpdateRole, http.StatusInternalServerError},
	{common.ErrFailedToDecodeRole, http.StatusInternalServerError},
	{common.ErrFailedToFetchPermission, http.StatusInternalServerError},
	{common.ErrFailedToFetchPermissions, http.StatusInternalServerError},
	{common.ErrFailedToCreatePermission, http.StatusInternalServerError},
	{common.ErrFailedToDecodePermission, http.StatusInternalServerError},
	{common.ErrOracleUnavailable, http.StatusServiceUnavailable},
	{common.ErrInvalidReportDate, http.StatusBadRequest},
	{common.ErrInvalidDateRange, http.StatusBadRequest},
	{common.ErrFailedToFetchReport, http.StatusInternalServerError},
}

func writeAppError(c *gin.Context, err error) {
	status := http.StatusInternalServerError
	message := err.Error()

	for _, mapped := range appErrors {
		if errors.Is(err, mapped.err) {
			status = mapped.status
			message = mapped.err.Error()
			break
		}
	}

	logrus.WithError(err).Error(message)
	c.JSON(status, response.Status{
		IsSuccessful: false,
		Message:      message,
		Error:        err.Error(),
	})
}
