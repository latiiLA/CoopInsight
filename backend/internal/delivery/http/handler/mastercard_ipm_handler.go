package handler

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

const maxMastercardIPMUploadBytes = 50 << 20 // 50 MiB

var errMastercardIPMUploadTooLarge = errors.New("IPM upload exceeds 50 MiB limit")

// maxBytesReader rejects reads past max (prevents silently truncated IPM parses).
type maxBytesReader struct {
	r    io.Reader
	left int64
}

func (m *maxBytesReader) Read(p []byte) (int, error) {
	if m.left < 0 {
		return 0, errMastercardIPMUploadTooLarge
	}
	if m.left == 0 {
		var b [1]byte
		n, err := m.r.Read(b[:])
		if n > 0 {
			m.left = -1
			return 0, errMastercardIPMUploadTooLarge
		}
		return 0, err
	}
	if int64(len(p)) > m.left {
		p = p[:m.left]
	}
	n, err := m.r.Read(p)
	m.left -= int64(n)
	return n, err
}

// MastercardIPMHandler defines the interface for Mastercard IPM HTTP operations.
type MastercardIPMHandler interface {
	UploadReport(c *gin.Context)
	GetByDateRange(c *gin.Context)
	GetBySTAN(c *gin.Context)
	SearchBySTAN(c *gin.Context)
	GetBatchSummary(c *gin.Context)
	GetBatchRecords(c *gin.Context)
	GetByPAN(c *gin.Context)
	ListBatchSummaries(c *gin.Context)
}

type mastercardIPMHandler struct {
	mastercardIPMService service.MastercardIPMService
}

// NewMastercardIPMHandler returns a new instance implementing MastercardIPMHandler.
func NewMastercardIPMHandler(ipmService service.MastercardIPMService) MastercardIPMHandler {
	return &mastercardIPMHandler{
		mastercardIPMService: ipmService,
	}
}

// UploadReport handles POST requests with multipart file uploads for Mastercard IPM files.
func (h *mastercardIPMHandler) UploadReport(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "File is required. Ensure 'file' form key is present in multipart request",
		})
		return
	}

	if fileHeader.Size > maxMastercardIPMUploadBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"error": errMastercardIPMUploadTooLarge.Error(),
		})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to read uploaded file stream",
		})
		return
	}
	defer func() { _ = file.Close() }()

	limited := &maxBytesReader{r: file, left: maxMastercardIPMUploadBytes}
	summary, err := h.mastercardIPMService.ProcessReportFile(c.Request.Context(), fileHeader.Filename, limited)
	if err != nil {
		if errors.Is(err, errMastercardIPMUploadTooLarge) {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{
				"error": errMastercardIPMUploadTooLarge.Error(),
			})
			return
		}
		if summary != nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"error":   err.Error(),
				"summary": summary,
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Mastercard IPM report processed successfully",
		"data":    summary,
	})
}

// GetByDateRange returns transactions within [start, end] (inclusive, full days).
//
//	GET /api/v1/mastercard-ipm?start=2025-09-01&end=2025-09-30
func (h *mastercardIPMHandler) GetByDateRange(c *gin.Context) {
	startStr := c.Query("start")
	endStr := c.Query("end")

	if startStr == "" || endStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query params 'start' and 'end' are required (YYYY-MM-DD)"})
		return
	}

	start, err := time.Parse("2006-01-02", startStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start date, use YYYY-MM-DD"})
		return
	}
	end, err := time.Parse("2006-01-02", endStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end date, use YYYY-MM-DD"})
		return
	}
	if end.Before(start) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "end must be on or after start"})
		return
	}

	txs, err := h.mastercardIPMService.GetByDateRange(c.Request.Context(), start, end)
	if err != nil {
		if strings.Contains(err.Error(), "endDate must be on or after startDate") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch IPM transactions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count": len(txs),
		"data":  txs,
	})
}

// GetBySTAN returns a single transaction.
//
//	GET /api/v1/mastercard-ipm/transactions/:stan
func (h *mastercardIPMHandler) GetBySTAN(c *gin.Context) {
	stan := c.Param("stan")
	if stan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "stan is required"})
		return
	}

	tx, err := h.mastercardIPMService.GetBySTAN(c.Request.Context(), stan)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if tx == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "transaction not found"})
		return
	}

	c.JSON(http.StatusOK, tx)
}

// SearchBySTAN returns records whose STAN starts with the given text.
//
//	GET /api/v1/mastercard-ipm/stan-search?query=3862535
func (h *mastercardIPMHandler) SearchBySTAN(c *gin.Context) {
	query := strings.TrimSpace(c.Query("query"))
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query param 'query' is required"})
		return
	}

	txs, err := h.mastercardIPMService.SearchBySTAN(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count": len(txs),
		"data":  txs,
	})
}

// GetByPAN returns all transactions for a PAN (newest first).
//
//	GET /api/v1/mastercard-ipm/pans/:pan
func (h *mastercardIPMHandler) GetByPAN(c *gin.Context) {
	pan := c.Param("pan")
	if pan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "pan is required"})
		return
	}

	txs, err := h.mastercardIPMService.GetByPAN(c.Request.Context(), pan)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count": len(txs),
		"data":  txs,
	})
}

// GetBatchSummary returns one batch summary by ID.
//
//	GET /api/v1/mastercard-ipm/batches/:batchId
func (h *mastercardIPMHandler) GetBatchSummary(c *gin.Context) {
	batchID := c.Param("batchId")
	if batchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "batchId is required"})
		return
	}

	summary, err := h.mastercardIPMService.GetBatchSummary(c.Request.Context(), batchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if summary == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "batch not found"})
		return
	}

	c.JSON(http.StatusOK, summary)
}

// GetBatchRecords returns the records captured by one upload.
//
//	GET /api/v1/mastercard-ipm/batches/:batchId/transactions
func (h *mastercardIPMHandler) GetBatchRecords(c *gin.Context) {
	batchID := c.Param("batchId")
	if batchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "batchId is required"})
		return
	}

	txs, err := h.mastercardIPMService.GetBatchRecords(c.Request.Context(), batchID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count": len(txs),
		"data":  txs,
	})
}

// ListBatchSummaries returns recent batch summaries.
//
//	GET /api/v1/mastercard-ipm/batches?limit=20
func (h *mastercardIPMHandler) ListBatchSummaries(c *gin.Context) {
	limit := int64(20)
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.ParseInt(l, 10, 64); err == nil {
			limit = parsed
		}
	}

	summaries, err := h.mastercardIPMService.ListBatchSummaries(c.Request.Context(), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count": len(summaries),
		"data":  summaries,
	})
}
