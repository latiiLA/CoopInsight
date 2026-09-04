package common

import "errors"

var (
	ErrInvalidCredentials    = errors.New("Invalid username or password")
	ErrUserAccessRevoked     = errors.New("User access has been revoked or user is deleted")
	ErrADUserNotFound        = errors.New("User not found in AD")
	ErrUserNotFound          = errors.New("User not found")
	ErrUsernameAlreadyExists = errors.New("username already exists")

	ErrRoleNotFound          = errors.New("role not found")
	ErrRoleNameAlreadyExists = errors.New("role with this name already exists")
	ErrRoleNameNotAllowed    = errors.New("role name not allowed")

	ErrPermissionNotFound      = errors.New("permission not found")
	ErrPermissionAlreadyExists = errors.New("permission already exists")

	ErrUnauthorized      = errors.New("unauthorized")
	ErrInternalServer    = errors.New("internal server error")
	ErrOracleUnavailable = errors.New("oracle is unavailable")
)

var (
	MessInternalServerError = "Internal server error"
	MessUnauthorized        = "Unauthorized"
	MessInvalidRequest      = "Invalid request"
	MessInvalidRequestData  = "Invalid request data"
	MessInvalidRequestFile = "Invalid request data"
	MessOracleUnavailable  = "Oracle is unavailable"
)
