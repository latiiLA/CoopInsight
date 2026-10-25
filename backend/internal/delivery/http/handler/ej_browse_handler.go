package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type EJBrowseHandler interface {
	ListTerminals(c *gin.Context)
	ListFiles(c *gin.Context)
	GetJournalFile(c *gin.Context)
	DownloadJournalFile(c *gin.Context)
}

type ejBrowseHandler struct {
	service service.EJBrowseService
}

func NewEJBrowseHandler(browseService service.EJBrowseService) EJBrowseHandler {
	return &ejBrowseHandler{service: browseService}
}

func (h *ejBrowseHandler) ListTerminals(c *gin.Context) {
	if h == nil || h.service == nil {
		writeAppError(c, common.ErrEJSearchUnavailable)
		return
	}
	rows, err := h.service.ListTerminals(
		c.Request.Context(),
		strings.TrimSpace(c.Query("dateFrom")),
		strings.TrimSpace(c.Query("dateTo")),
	)
	if err != nil {
		writeAppError(c, err)
		return
	}
	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "EJ terminals listed successfully",
		Data:         rows,
	})
}

func (h *ejBrowseHandler) ListFiles(c *gin.Context) {
	if h == nil || h.service == nil {
		writeAppError(c, common.ErrEJSearchUnavailable)
		return
	}
	terminal := strings.TrimSpace(c.Param("terminalId"))
	if terminal == "" {
		terminal = strings.TrimSpace(c.Query("terminal"))
	}
	rows, err := h.service.ListFiles(
		c.Request.Context(),
		terminal,
		strings.TrimSpace(c.Query("dateFrom")),
		strings.TrimSpace(c.Query("dateTo")),
	)
	if err != nil {
		writeAppError(c, err)
		return
	}
	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "EJ files listed successfully",
		Data:         rows,
	})
}

func (h *ejBrowseHandler) GetJournalFile(c *gin.Context) {
	if h == nil || h.service == nil {
		writeAppError(c, common.ErrEJSearchUnavailable)
		return
	}
	terminal := strings.TrimSpace(c.Param("terminalId"))
	filename := strings.TrimSpace(c.Param("filename"))
	if terminal == "" {
		terminal = strings.TrimSpace(c.Query("terminal"))
	}
	if filename == "" {
		filename = strings.TrimSpace(c.Query("filename"))
	}
	view, err := h.service.GetJournalFile(c.Request.Context(), terminal, filename)
	if err != nil {
		writeAppError(c, err)
		return
	}
	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "EJ journal file fetched successfully",
		Data:         view,
	})
}

func (h *ejBrowseHandler) DownloadJournalFile(c *gin.Context) {
	if h == nil || h.service == nil {
		writeAppError(c, common.ErrEJSearchUnavailable)
		return
	}
	terminal := strings.TrimSpace(c.Param("terminalId"))
	filename := strings.TrimSpace(c.Param("filename"))
	if terminal == "" {
		terminal = strings.TrimSpace(c.Query("terminal"))
	}
	if filename == "" {
		filename = strings.TrimSpace(c.Query("filename"))
	}
	path, name, err := h.service.OpenJournalDownload(c.Request.Context(), terminal, filename)
	if err != nil {
		writeAppError(c, err)
		return
	}
	c.FileAttachment(path, name)
}
