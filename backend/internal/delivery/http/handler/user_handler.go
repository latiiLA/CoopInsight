package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/dto"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type UserHandler interface {
	Login(c *gin.Context)
	GetAll(c *gin.Context)
	GetByID(c *gin.Context)
	Create(c *gin.Context)
	Update(c *gin.Context)
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
			return
		}

		c.JSON(http.StatusBadRequest, response.Status{
			Message: common.MessInvalidRequest,
			Error:   err.Error(),
		})
		return
	}

	username := strings.ToLower(req.Username)

	// Call the usecase to perform authentication
	user, err := a.userService.Authenticate(
		c,
		username,
		req.Password,
		c.ClientIP(),
	)

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
	c.JSON(http.StatusOK, gin.H{
		"message": "Get all users",
	})
}

func (h *userHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	c.JSON(http.StatusOK, gin.H{
		"message": "Get user",
		"id":      id,
	})
}

func (h *userHandler) Create(c *gin.Context) {
	c.JSON(http.StatusCreated, gin.H{
		"message": "Create user",
	})
}

func (h *userHandler) Update(c *gin.Context) {
	id := c.Param("id")

	c.JSON(http.StatusOK, gin.H{
		"message": "Update user",
		"id":      id,
	})
}

func (h *userHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	c.JSON(http.StatusOK, gin.H{
		"message": "Delete user",
		"id":      id,
	})
}
