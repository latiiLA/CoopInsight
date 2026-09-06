package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type PosTerminalHandler interface {
	GetAll(c *gin.Context)
}

type posTerminalHandler struct {
	service service.PosTerminalService
}

func NewPosTerminalHandler(service service.PosTerminalService) PosTerminalHandler {
	return &posTerminalHandler{
		service: service,
	}
}

func (h *posTerminalHandler) GetAll(c *gin.Context) {
	terminals, err := h.service.GetAll(c.Request.Context())
	if err != nil {
		writeAppError(c, err)
		return
	}

	if terminals == nil {
		terminals = []model.PosTerminal{}
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "POS terminals fetched successfully",
		Data:         terminals,
	})
}
