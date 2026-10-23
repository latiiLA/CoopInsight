package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type TerminalReconExportHandler interface {
	Export(c *gin.Context)
	Chunk(c *gin.Context)
}

type terminalReconExportHandler struct {
	service service.TerminalReconExportService
}

func NewTerminalReconExportHandler(
	service service.TerminalReconExportService,
) TerminalReconExportHandler {
	return &terminalReconExportHandler{service: service}
}

func (h *terminalReconExportHandler) Chunk(c *gin.Context) {
	page, _ := strconv.Atoi(strings.TrimSpace(c.Query("page")))
	pageSize, _ := strconv.Atoi(strings.TrimSpace(c.Query("pageSize")))
	req := model.TerminalReconChunkRequest{
		Source:   strings.TrimSpace(c.Query("source")),
		DateFrom: strings.TrimSpace(c.Query("dateFrom")),
		DateTo:   strings.TrimSpace(c.Query("dateTo")),
		Terminal: strings.TrimSpace(c.Query("terminal")),
		Page:     page,
		PageSize: pageSize,
	}

	result, err := h.service.Chunk(c.Request.Context(), req)
	if err != nil {
		writeAppError(c, err)
		return
	}
	if result.Rows == nil {
		result.Rows = [][]string{}
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "Terminal recon chunk fetched successfully",
		Data:         result,
	})
}

func (h *terminalReconExportHandler) Export(c *gin.Context) {
	req := model.TerminalReconExportRequest{
		Source:   strings.TrimSpace(c.Query("source")),
		DateFrom: strings.TrimSpace(c.Query("dateFrom")),
		DateTo:   strings.TrimSpace(c.Query("dateTo")),
		Terminal: strings.TrimSpace(c.Query("terminal")),
		Format:   strings.TrimSpace(c.Query("format")),
	}

	prepared, filename, contentType, err := h.service.Prepare(req)
	if err != nil {
		writeAppError(c, err)
		return
	}

	c.Header("Content-Type", contentType)
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Header("X-Content-Type-Options", "nosniff")
	c.Status(http.StatusOK)

	if err := h.service.Write(c.Request.Context(), prepared, c.Writer); err != nil {
		// Body may already be partially written; cannot switch to JSON cleanly.
		_ = c.Error(err)
		return
	}
}
