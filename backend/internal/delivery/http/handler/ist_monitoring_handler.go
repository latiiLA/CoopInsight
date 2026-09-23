package handler

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
	"github.com/sirupsen/logrus"
)

type ISTMonitoringHandler interface {
	Stream(c *gin.Context)
}

type istMonitoringHandler struct {
	service service.ISTMonitoringService
}

func NewISTMonitoringHandler(service service.ISTMonitoringService) ISTMonitoringHandler {
	return &istMonitoringHandler{service: service}
}

func (h *istMonitoringHandler) Stream(c *gin.Context) {
	frames, cancel, err := h.service.Subscribe()
	if err != nil {
		writeAppError(c, err)
		return
	}
	defer cancel()

	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     allowSocketOrigin,
		Subprotocols:    websocket.Subprotocols(c.Request),
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logrus.WithError(err).Warn("IST monitoring websocket upgrade failed")
		return
	}
	defer func() { _ = conn.Close() }()

	done := make(chan struct{})
	go func() {
		defer close(done)
		conn.SetReadLimit(1024)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()

	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-done:
			return
		case <-c.Request.Context().Done():
			return
		case <-ticker.C:
			_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		case frame, ok := <-frames:
			if !ok {
				return
			}
			_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteJSON(frame); err != nil {
				return
			}
		}
	}
}
