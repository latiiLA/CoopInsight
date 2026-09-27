package router

import (
	"github.com/gin-gonic/gin"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/http/handler"
)

func registerVisaSettlementRoutes(protected *gin.RouterGroup, visaSettlementHandler handler.VisaSettlementHandler) {
	visa := protected.Group("/visa-settlements")

	visa.POST("/upload", visaSettlementHandler.UploadReport)
	// Fetch
	visa.GET("", visaSettlementHandler.GetByDateRange)                           // ?start=2025-09-01&end=2025-09-30
	visa.GET("/transaction-search", visaSettlementHandler.SearchByTransactionID) // ?query=3862535
	visa.GET("/transactions/:transactionId", visaSettlementHandler.GetByTransactionID)
	visa.GET("/accounts/:accountNumber", visaSettlementHandler.GetByAccountNumber)
	visa.GET("/batches", visaSettlementHandler.ListBatchSummaries) // ?limit=20
	visa.GET("/batches/:batchId", visaSettlementHandler.GetBatchSummary)
	visa.GET("/batches/:batchId/transactions", visaSettlementHandler.GetBatchRecords)
}
