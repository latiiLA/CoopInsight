package common

import "errors"

var (
	ErrInvalidCredentials           = errors.New("invalid username or password")
	ErrUserAccessRevoked            = errors.New("user access has been revoked or user is deleted")
	ErrInvalidRefreshToken          = errors.New("invalid or expired refresh token")
	ErrADUserNotFound               = errors.New("username does not exist in active directory")
	ErrADUnavailable                = errors.New("active directory is unavailable")
	ErrUserNotFound                 = errors.New("user not found")
	ErrUsernameAlreadyExists        = errors.New("username already exists")
	ErrAccountPendingApproval       = errors.New("account request is pending approval")
	ErrAccountRequestNotFound       = errors.New("account request not found")
	ErrAccountRequestAlreadyHandled = errors.New("account request has already been handled")
	ErrFailedToFetchAccountRequests = errors.New("failed to fetch account requests")
	ErrFailedToCreateAccountRequest = errors.New("failed to create account request")
	ErrFailedToUpdateAccountRequest = errors.New("failed to update account request")
	ErrFailedToFetchUser            = errors.New("failed to fetch user")
	ErrFailedToFetchUsers           = errors.New("failed to fetch users")
	ErrFailedToCreateUser           = errors.New("failed to create user")
	ErrFailedToUpdateUser           = errors.New("failed to update user")
	ErrFailedToDeleteUser           = errors.New("failed to delete user")
	ErrCannotDeleteSelf             = errors.New("you cannot delete your own account")
	ErrUserHasActivity              = errors.New("user has activity and cannot be deleted; deactivate instead")
	ErrInvalidAvatar                = errors.New("invalid avatar")
	ErrInvalidAvatarFile            = errors.New("photo must be a JPEG, PNG, or WebP under 2 MB")
	ErrInvalidProfile               = errors.New("invalid profile")
	ErrFailedToDecodeUser           = errors.New("failed to decode user")

	ErrRoleNotFound          = errors.New("role not found")
	ErrRoleNameAlreadyExists = errors.New("role with this name already exists")
	ErrRoleNameNotAllowed    = errors.New("role name not allowed")
	ErrRoleInUse             = errors.New("role is assigned to a user")
	ErrFailedToFetchRole     = errors.New("failed to fetch role")
	ErrFailedToFetchRoles    = errors.New("failed to fetch roles")
	ErrFailedToCreateRole    = errors.New("failed to create role")
	ErrFailedToUpdateRole    = errors.New("failed to update role")
	ErrFailedToDeleteRole    = errors.New("failed to delete role")
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

	ErrUnauthorized                          = errors.New("unauthorized")
	ErrInternalServer                        = errors.New("internal server error")
	ErrOracleUnavailable                     = errors.New("oracle is unavailable")
	ErrSourceMongoUnavailable                = errors.New("source mongo is unavailable")
	ErrInvalidReportDate                     = errors.New("dateFrom and dateTo must be MM-DD-YYYY")
	ErrInvalidDateRange                      = errors.New("dateFrom must be on or before dateTo")
	ErrInvalidTerminalID                     = errors.New("terminalId is required")
	ErrInvalidFleet                          = errors.New("fleet must be atm or pos")
	ErrFailedToFetchReport                   = errors.New("failed to fetch report")
	ErrFailedToFetchAtmTerminals             = errors.New("failed to fetch ATM terminals")
	ErrFailedToFetchPosTerminals             = errors.New("failed to fetch POS terminals")
	ErrOnusMonitoringUnavailable             = errors.New("on-us monitoring is unavailable")
	ErrOffusMonitoringUnavailable            = errors.New("off-us monitoring is unavailable")
	ErrMastercardDebitMonitoringUnavailable  = errors.New("mastercard debit monitoring is unavailable")
	ErrMastercardCreditMonitoringUnavailable = errors.New("mastercard credit monitoring is unavailable")
	ErrVisaMonitoringUnavailable             = errors.New("visa monitoring is unavailable")
	ErrSwitchCommandUnavailable              = errors.New("switch command is unavailable")
	ErrInvalidSwitchCommand                  = errors.New("invalid switch command")
	ErrSwitchCommandTimeout                  = errors.New("switch command timed out")
)

var (
	MessInternalServerError    = "Internal server error"
	MessUnauthorized           = "Unauthorized"
	MessInvalidRequest         = "Invalid request"
	MessInvalidRequestData     = "Invalid request data"
	MessInvalidRequestFile     = "Invalid request data"
	MessOracleUnavailable      = "Oracle is unavailable"
	MessSourceMongoUnavailable = "Source Mongo is unavailable"
)
