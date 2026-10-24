package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/common/response"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

type EJTransactionSearchHandler interface {
	Search(c *gin.Context)
	GetByID(c *gin.Context)
	GetJournal(c *gin.Context)
	GetJournalFile(c *gin.Context)
	DownloadJournalFile(c *gin.Context)
	GetCoverage(c *gin.Context)
}

type ejTransactionSearchHandler struct {
	service  service.EJTransactionSearchService
	coverage service.EJCoverageService
}

func NewEJTransactionSearchHandler(
	searchService service.EJTransactionSearchService,
	coverageService service.EJCoverageService,
) EJTransactionSearchHandler {
	return &ejTransactionSearchHandler{
		service:  searchService,
		coverage: coverageService,
	}
}

func (h *ejTransactionSearchHandler) GetCoverage(c *gin.Context) {
	if h == nil || h.coverage == nil {
		writeAppError(c, common.ErrEJSearchUnavailable)
		return
	}
	result, err := h.coverage.GetCoverage(c.Request.Context(), model.EJCoverageRequest{
		DateFrom: strings.TrimSpace(c.Query("dateFrom")),
		DateTo:   strings.TrimSpace(c.Query("dateTo")),
	})
	if err != nil {
		writeAppError(c, err)
		return
	}
	if result.Days == nil {
		result.Days = []model.EJCoverageDaySummary{}
	}
	if result.Terminals == nil {
		result.Terminals = []model.EJCoverageTerminal{}
	}
	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "EJ coverage loaded successfully",
		Data:         result,
	})
}

func (h *ejTransactionSearchHandler) Search(c *gin.Context) {
	page, pageSize := parseClearingPagination(c)
	if pageSize > 500 {
		pageSize = 500
	}
	req := model.EJTransactionSearchRequest{
		DateFrom:        strings.TrimSpace(c.Query("dateFrom")),
		DateTo:          strings.TrimSpace(c.Query("dateTo")),
		CardFirst4:      strings.TrimSpace(c.Query("cardFirst4")),
		CardLast4:       strings.TrimSpace(c.Query("cardLast4")),
		Terminal:        strings.TrimSpace(c.Query("terminal")),
		AuthNum:         strings.TrimSpace(c.Query("authNum")),
		Status:          strings.TrimSpace(c.Query("status")),
		CustomerAccount: strings.TrimSpace(c.Query("customerAccount")),
	}
	// Convenience: card=9231xxxx6542 or digits-only PAN fragment.
	if card := strings.TrimSpace(c.Query("card")); card != "" {
		if req.CardFirst4 == "" && req.CardLast4 == "" {
			req.CardFirst4 = card
		}
	}
	if amtRaw := strings.TrimSpace(c.Query("amount")); amtRaw != "" {
		if v, err := strconv.ParseFloat(amtRaw, 64); err == nil {
			req.Amount = &v
		}
	}

	result, err := h.service.Search(c.Request.Context(), req, page, pageSize)
	if err != nil {
		writeAppError(c, err)
		return
	}
	if result.Items == nil {
		result.Items = []model.EJTransaction{}
	}

	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "EJ transaction search completed successfully",
		Data:         result,
	})
}

func (h *ejTransactionSearchHandler) GetByID(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		writeAppError(c, common.ErrInvalidEJTransactionID)
		return
	}
	row, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil {
		writeAppError(c, err)
		return
	}
	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "EJ transaction detail fetched successfully",
		Data:         row,
	})
}

func (h *ejTransactionSearchHandler) GetJournal(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		writeAppError(c, common.ErrInvalidEJTransactionID)
		return
	}
	view, err := h.service.GetJournal(c.Request.Context(), id)
	if err != nil {
		writeAppError(c, err)
		return
	}
	c.JSON(http.StatusOK, response.Status{
		IsSuccessful: true,
		Message:      "EJ journal block fetched successfully",
		Data:         view,
	})
}

func (h *ejTransactionSearchHandler) GetJournalFile(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		writeAppError(c, common.ErrInvalidEJTransactionID)
		return
	}
	view, err := h.service.GetJournalFile(c.Request.Context(), id)
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

func (h *ejTransactionSearchHandler) DownloadJournalFile(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		writeAppError(c, common.ErrInvalidEJTransactionID)
		return
	}
	path, name, err := h.service.OpenJournalDownload(c.Request.Context(), id)
	if err != nil {
		writeAppError(c, err)
		return
	}
	c.FileAttachment(path, name)
}
