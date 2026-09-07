package handler

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/dto"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/utils"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type UserHandler interface {
	Login(c *gin.Context)
	LoginLocal(c *gin.Context)
	Refresh(c *gin.Context)
	GetAll(c *gin.Context)
	GetByID(c *gin.Context)
	Create(c *gin.Context)
	RequestAccount(c *gin.Context)
	ListAccountRequests(c *gin.Context)
	GetAccountRequest(c *gin.Context)
	Update(c *gin.Context)
	UpdateAvatar(c *gin.Context)
	UploadAvatarPhoto(c *gin.Context)
	UpdateProfile(c *gin.Context)
	Delete(c *gin.Context)
}

type userHandler struct {
	userService service.UserService
}

func NewUserHandler(userService service.UserService) UserHandler {
	return &userHandler{
		userService: userService,
	}
}

func (a *userHandler) Login(c *gin.Context) {
	req, ok := bindLoginRequest(c)
	if !ok {
		return
	}

	username := strings.ToLower(req.Username)

	user, err := a.userService.Authenticate(
		c,
		username,
		req.Password,
		c.ClientIP(),
	)

	a.writeLoginResult(c, user, err)
}

func (a *userHandler) LoginLocal(c *gin.Context) {
	req, ok := bindLoginRequest(c)
	if !ok {
		return
	}

	username := strings.ToLower(req.Username)

	user, err := a.userService.AuthenticateLocal(
		c,
		username,
		req.Password,
		c.ClientIP(),
	)

	a.writeLoginResult(c, user, err)
}

func (a *userHandler) Refresh(c *gin.Context) {
	var req dto.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      common.MessInvalidRequest,
			Error:        err.Error(),
		})
		return
	}

	user, err := a.userService.RefreshSession(c, req.RefreshToken, c.ClientIP())
	a.writeLoginResult(c, user, err)
}

func bindLoginRequest(c *gin.Context) (dto.LoginRequest, bool) {
	var req dto.LoginRequest

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
			return dto.LoginRequest{}, false
		}

		c.JSON(http.StatusBadRequest, response.Status{
			Message: common.MessInvalidRequest,
			Error:   err.Error(),
		})
		return dto.LoginRequest{}, false
	}

	return req, true
}

func (a *userHandler) writeLoginResult(c *gin.Context, user *dto.LoginResponse, err error) {
	if err != nil {
		var (
			status  int
			message string
		)

		switch {
		case errors.Is(err, common.ErrInvalidCredentials):
			status = http.StatusUnauthorized
			message = "Invalid credentials"

		case errors.Is(err, common.ErrUserAccessRevoked):
			status = http.StatusUnauthorized
			message = "Account status has been disabled"

		case errors.Is(err, common.ErrInvalidRefreshToken):
			status = http.StatusUnauthorized
			message = "Session expired. Please sign in again"

		case errors.Is(err, common.ErrAccountPendingApproval):
			status = http.StatusForbidden
			message = "Your account request is pending approval"

		case errors.Is(err, common.ErrADUserNotFound):
			status = http.StatusForbidden
			message = "User doesn't have AD account"

		case errors.Is(err, common.ErrUserNotFound):
			status = http.StatusForbidden
			message = "User isn't registered for the system"

		default:
			status = http.StatusInternalServerError
			message = common.MessInternalServerError
		}

		c.JSON(status, response.Status{
			Message: message,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Logged in successfully",
		Data:         user,
	})
}

// func (a *userHandler) Register(c *gin.Context) {
// 	var (
// 		status  int
// 		message string
// 	)

// 	logEntry := utils.GetLogger(c)
// 	authUserID, _ := utils.GetUserID(c)

// 	var registerReq dto.RegisterRequest
// 	if err := c.ShouldBindJSON(&registerReq); err != nil {
// 		if validationErrors, ok := err.(validator.ValidationErrors); ok {
// 			e := validationErrors[0]
// 			message := fmt.Sprintf("%s failed on %s validation", e.Field(), e.Tag())

// 			c.JSON(http.StatusBadRequest, response.Status{
// 				Message: message,
// 				Error:   err.Error(),
// 			})

// 			return
// 		}

// 		c.JSON(http.StatusBadRequest, response.Status{
// 			Message: common.MessInvalidRequest,
// 			Error:   err.Error(),
// 		})
// 		return
// 	}

// 	// Call AuthUsecase (LDAP) ---
// 	adUser, err := a.authUsecase.GetUserDetails(c.Request.Context(), strings.ToLower(registerReq.Username))
// 	if err != nil {
// 		logEntry.Warn("Get user detail from AD error: ", err)

// 		switch {
// 		case errors.Is(err, common.ErrADUserNotFound):
// 			status = http.StatusForbidden
// 			message = "User don't have AD account"

// 		default:
// 			status = http.StatusInternalServerError
// 			message = common.MessInternalServerError
// 		}

// 		c.JSON(status, response.Status{Message: message, Error: err.Error()})
// 		return
// 	}

// 	RegisterUsecaseReq := model.RegisterUsecaseRequestDTO{
// 		Username:     strings.ToLower(registerReq.Username),
// 		FirstName:    adUser.Profile.FirstName,
// 		MiddleName:   adUser.Profile.MiddleName,
// 		LastName:     registerReq.LastName,
// 		DisplayName:  adUser.Profile.DisplayName,
// 		Email:        adUser.Profile.Email,
// 		BranchID:     registerReq.BranchID,
// 		DepartmentID: registerReq.DepartmentID,
// 		Role:         registerReq.Role,
// 	}

// 	if len(registerReq.Permissions) != 0 {
// 		RegisterUsecaseReq.Permissions = registerReq.Permissions
// 	}

// 	err = a.userUsecase.Register(c.Request.Context(), authUserID, &RegisterUsecaseReq)
// 	if err != nil {
// 		switch {
// 		case errors.Is(err, errors.ErrUsernameAlreadyExists):

// 			status = http.StatusConflict
// 			message = "Username already has been registered"

// 		default:
// 			status = http.StatusInternalServerError
// 			message = errors.MessInternalServerError
// 		}

// 		c.JSON(status, response.Status{Message: message, Error: err.Error()})
// 		return
// 	}

// 	c.JSON(http.StatusOK, response.Status{IsSuccessful: true, Message: "User registered successfully"})
// }

func (h *userHandler) GetAll(c *gin.Context) {
	users, err := h.userService.GetAll(c)
	if err != nil {
		writeAppError(c, err)
		return
	}

	// Ensure slice is initialized as empty slice instead of nil for clean JSON output ("[]" instead of "null")
	if users == nil {
		users = []model.User{}
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Users fetched successfully",
		Data:         users,
	})
}

func parseObjectIDParam(c *gin.Context, name string) (primitive.ObjectID, bool) {
	objectID, err := primitive.ObjectIDFromHex(c.Param(name))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      common.MessInvalidRequest,
			Error:        "invalid id",
		})
		return primitive.NilObjectID, false
	}

	return objectID, true
}

func (h *userHandler) GetByID(c *gin.Context) {
	userID, ok := parseObjectIDParam(c, "id")
	if !ok {
		return
	}

	user, err := h.userService.GetByID(c, userID)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "User fetched successfully",
		Data:         user,
	})
}

func (h *userHandler) Create(c *gin.Context) {
	authUserID, err := utils.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, response.Status{
			IsSuccessful: false,
			Message:      common.MessUnauthorized,
			Error:        err.Error(),
		})
		return
	}

	var req dto.RegisterRequest
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

	err = h.userService.Register(c, authUserID, &req)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusCreated, response.Status{
		IsSuccessful: true,
		Message:      "User registered successfully",
	})
}

func (h *userHandler) RequestAccount(c *gin.Context) {
	var req dto.RequestAccountRequest
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

	err := h.userService.RequestAccount(c, &req)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusCreated, response.Status{
		IsSuccessful: true,
		Message:      "Account request submitted. An administrator will review it before you can sign in.",
	})
}

func (h *userHandler) ListAccountRequests(c *gin.Context) {
	requests, err := h.userService.ListAccountRequests(c)
	if err != nil {
		writeAppError(c, err)
		return
	}

	if requests == nil {
		requests = []model.AccountRequest{}
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Account requests fetched successfully",
		Data:         requests,
	})
}

func (h *userHandler) GetAccountRequest(c *gin.Context) {
	requestID, ok := parseObjectIDParam(c, "id")
	if !ok {
		return
	}

	request, err := h.userService.GetAccountRequest(c, requestID)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Account request fetched successfully",
		Data:         request,
	})
}

func (h *userHandler) Update(c *gin.Context) {
	userID, ok := parseObjectIDParam(c, "id")
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

	var req dto.UpdateUserRequest
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

	err = h.userService.Update(c, authUserID, userID, &req)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "User updated successfully",
	})
}

func (h *userHandler) UpdateAvatar(c *gin.Context) {
	authUserID, err := utils.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, response.Status{
			IsSuccessful: false,
			Message:      common.MessUnauthorized,
			Error:        err.Error(),
		})
		return
	}

	var req dto.UpdateAvatarRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      common.MessInvalidRequest,
			Error:        err.Error(),
		})
		return
	}

	if err := h.userService.UpdateAvatar(c, authUserID, req.Avatar); err != nil {
		writeAppError(c, err)
		return
	}

	normalized, _ := model.NormalizeAvatarChoice(req.Avatar)

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Avatar updated successfully",
		Data: gin.H{
			"avatar": normalized,
		},
	})
}

const maxAvatarBytes int64 = 2 * 1024 * 1024

func (h *userHandler) UploadAvatarPhoto(c *gin.Context) {
	authUserID, err := utils.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, response.Status{
			IsSuccessful: false,
			Message:      common.MessUnauthorized,
			Error:        err.Error(),
		})
		return
	}

	file, err := c.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      common.MessInvalidRequestFile,
			Error:        err.Error(),
		})
		return
	}

	if file.Size > maxAvatarBytes {
		writeAppError(c, common.ErrInvalidAvatarFile)
		return
	}

	src, err := file.Open()
	if err != nil {
		writeAppError(c, common.ErrInvalidAvatarFile)
		return
	}
	defer func() { _ = src.Close() }()

	data, err := io.ReadAll(io.LimitReader(src, maxAvatarBytes+1))
	if err != nil {
		writeAppError(c, common.ErrInvalidAvatarFile)
		return
	}
	if int64(len(data)) > maxAvatarBytes {
		writeAppError(c, common.ErrInvalidAvatarFile)
		return
	}

	avatar, err := h.userService.UploadAvatarPhoto(c, authUserID, data)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Avatar updated successfully",
		Data: gin.H{
			"avatar": avatar,
		},
	})
}

func (h *userHandler) UpdateProfile(c *gin.Context) {
	authUserID, err := utils.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, response.Status{
			IsSuccessful: false,
			Message:      common.MessUnauthorized,
			Error:        err.Error(),
		})
		return
	}

	var req dto.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Status{
			IsSuccessful: false,
			Message:      common.MessInvalidRequest,
			Error:        err.Error(),
		})
		return
	}

	profile, err := h.userService.UpdateProfile(c, authUserID, &req)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Profile updated successfully",
		Data: gin.H{
			"profile": profile,
		},
	})
}

func (h *userHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	c.JSON(http.StatusOK, gin.H{
		"message": "Delete user",
		"id":      id,
	})
}
