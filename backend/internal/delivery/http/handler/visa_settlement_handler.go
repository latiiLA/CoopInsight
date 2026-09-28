package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/service"
)

// VisaSettlementHandler defines the interface for settlement HTTP operations (optional).
type VisaSettlementHandler interface {
	UploadReport(c *gin.Context)
	GetByDateRange(c *gin.Context)
	GetByTransactionID(c *gin.Context)
	SearchByTransactionID(c *gin.Context)
	GetBatchSummary(c *gin.Context)
	GetBatchRecords(c *gin.Context)
	GetByAccountNumber(c *gin.Context)
	ListBatchSummaries(c *gin.Context)
}

type visaSettlementHandler struct {
	visaSettlementService service.VisaSettlementService
}

// NewVisaSettlementHandler returns a new instance implementing VisaSettlementHandler.
func NewVisaSettlementHandler(settlementService service.VisaSettlementService) VisaSettlementHandler {
	return &visaSettlementHandler{
		visaSettlementService: settlementService,
	}
}

// UploadReport handles POST requests with multipart file uploads for Visa settlement reports.
func (h *visaSettlementHandler) UploadReport(c *gin.Context) {
	// 1. Retrieve file from multipart form key "file"
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "File is required. Ensure 'file' form key is present in multipart request",
		})
		return
	}

	// 2. Open file stream
	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to read uploaded file stream",
		})
		return
	}
	defer func() { _ = file.Close() }()

	// 3. Delegate file processing to the service layer
	summary, err := h.visaSettlementService.ProcessReportFile(c.Request.Context(), fileHeader.Filename, file)
	if err != nil {
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

	// 4. Return successful execution summary
	c.JSON(http.StatusOK, gin.H{
		"message": "Visa settlement report processed successfully",
		"data":    summary,
	})
}

// GetByDateRange returns transactions within [start, end] (inclusive, full days).
//
//	GET /api/v1/visa-settlements?start=2025-09-01&end=2025-09-30
func (h *visaSettlementHandler) GetByDateRange(c *gin.Context) {
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

	txs, err := h.visaSettlementService.GetByDateRange(c.Request.Context(), start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count": len(txs),
		"data":  txs,
	})
}

// GetByTransactionID returns a single transaction.
//
//	GET /api/v1/visa-settlements/transactions/:transactionId
func (h *visaSettlementHandler) GetByTransactionID(c *gin.Context) {
	transactionID := c.Param("transactionId")
	if transactionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "transactionId is required"})
		return
	}

	tx, err := h.visaSettlementService.GetByTransactionID(c.Request.Context(), transactionID)
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

// SearchByTransactionID returns records whose transaction id starts with the
// given text, so a truncated id can be found.
//
//	GET /api/v1/visa-settlements/transaction-search?query=3862535
func (h *visaSettlementHandler) SearchByTransactionID(c *gin.Context) {
	query := strings.TrimSpace(c.Query("query"))
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query param 'query' is required"})
		return
	}

	txs, err := h.visaSettlementService.SearchByTransactionID(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count": len(txs),
		"data":  txs,
	})
}

// GetByAccountNumber returns all transactions for an account (newest first).
//
//	GET /api/v1/visa-settlements/accounts/:accountNumber
func (h *visaSettlementHandler) GetByAccountNumber(c *gin.Context) {
	accountNumber := c.Param("accountNumber")
	if accountNumber == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "accountNumber is required"})
		return
	}

	txs, err := h.visaSettlementService.GetByAccountNumber(c.Request.Context(), accountNumber)
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
//	GET /api/v1/visa-settlements/batches/:batchId
func (h *visaSettlementHandler) GetBatchSummary(c *gin.Context) {
	batchID := c.Param("batchId")
	if batchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "batchId is required"})
		return
	}

	summary, err := h.visaSettlementService.GetBatchSummary(c.Request.Context(), batchID)
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
//	GET /api/v1/visa-settlements/batches/:batchId/transactions
func (h *visaSettlementHandler) GetBatchRecords(c *gin.Context) {
	batchID := c.Param("batchId")
	if batchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "batchId is required"})
		return
	}

	txs, err := h.visaSettlementService.GetBatchRecords(c.Request.Context(), batchID)
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
//	GET /api/v1/visa-settlements/batches?limit=20
func (h *visaSettlementHandler) ListBatchSummaries(c *gin.Context) {
	limit := int64(20)
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.ParseInt(l, 10, 64); err == nil {
			limit = parsed
		}
	}

	summaries, err := h.visaSettlementService.ListBatchSummaries(c.Request.Context(), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count": len(summaries),
		"data":  summaries,
	})
}
