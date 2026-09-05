package common

import "errors"

var (
	ErrInvalidCredentials    = errors.New("Invalid username or password")
	ErrUserAccessRevoked     = errors.New("User access has been revoked or user is deleted")
	ErrADUserNotFound        = errors.New("User not found in AD")
	ErrUserNotFound          = errors.New("User not found")
	ErrUsernameAlreadyExists = errors.New("username already exists")
	ErrFailedToFetchUser     = errors.New("failed to fetch user")
	ErrFailedToFetchUsers    = errors.New("failed to fetch users")
	ErrFailedToCreateUser    = errors.New("failed to create user")
	ErrFailedToUpdateUser    = errors.New("failed to update user")
	ErrFailedToDecodeUser    = errors.New("failed to decode user")

	ErrRoleNotFound          = errors.New("role not found")
	ErrRoleNameAlreadyExists = errors.New("role with this name already exists")
	ErrRoleNameNotAllowed    = errors.New("role name not allowed")
	ErrFailedToFetchRole     = errors.New("failed to fetch role")
	ErrFailedToFetchRoles    = errors.New("failed to fetch roles")
	ErrFailedToCreateRole    = errors.New("failed to create role")
	ErrFailedToUpdateRole    = errors.New("failed to update role")
	ErrFailedToDecodeRole    = errors.New("failed to decode role")

	ErrPermissionNotFound       = errors.New("permission not found")
	ErrPermissionAlreadyExists  = errors.New("permission already exists")
	ErrPermissionInUse          = errors.New("permission is assigned to a role or user")
	ErrFailedToFetchPermission  = errors.New("failed to fetch permission")
	ErrFailedToFetchPermissions = errors.New("failed to fetch permissions")
	ErrFailedToCreatePermission = errors.New("failed to create permission")
	ErrFailedToUpdatePermission = errors.New("failed to update permission")
	ErrFailedToDeletePermission = errors.New("failed to delete permission")
	ErrFailedToDecodePermission = errors.New("failed to decode permission")

	ErrUnauthorized               = errors.New("unauthorized")
	ErrInternalServer             = errors.New("internal server error")
	ErrOracleUnavailable          = errors.New("oracle is unavailable")
	ErrInvalidReportDate          = errors.New("dateFrom and dateTo must be MM-DD-YYYY")
	ErrInvalidDateRange           = errors.New("dateFrom must be on or before dateTo")
	ErrFailedToFetchReport        = errors.New("failed to fetch report")
	ErrOnusMonitoringUnavailable  = errors.New("on-us monitoring is unavailable")
	ErrOffusMonitoringUnavailable = errors.New("off-us monitoring is unavailable")
)

var (
	MessInternalServerError = "Internal server error"
	MessUnauthorized        = "Unauthorized"
	MessInvalidRequest      = "Invalid request"
	MessInvalidRequestData  = "Invalid request data"
	MessInvalidRequestFile  = "Invalid request data"
	MessOracleUnavailable   = "Oracle is unavailable"
)
