package repository

import (
	"context"
)

type TestRepository interface {
	GetTestData(ctx context.Context, dateFrom, dateTo string, page, pageSize int) ([]map[string]interface{}, error)
}
