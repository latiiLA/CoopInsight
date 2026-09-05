package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type AtmTerminalHandler interface {
	GetAll(c *gin.Context)
}

type atmTerminalHandler struct {
	service service.AtmTerminalService
}

func NewAtmTerminalHandler(service service.AtmTerminalService) AtmTerminalHandler {
	return &atmTerminalHandler{
		service: service,
	}
}

func (h *atmTerminalHandler) GetAll(c *gin.Context) {
	terminals, err := h.service.GetAll(c.Request.Context())
	if err != nil {
		writeAppError(c, err)
		return
	}

	if terminals == nil {
		terminals = []model.AtmTerminal{}
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "ATM terminals fetched successfully",
		Data:         terminals,
	})
}
