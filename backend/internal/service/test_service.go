package service

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

type TestService interface {
	GetTestData(ctx context.Context, dateFrom, dateTo string, page, pageSize int) ([]map[string]interface{}, error)
}

type testService struct {
	repository repository.TestRepository
}

func NewTestService(repository repository.TestRepository) TestService {
	return &testService{
		repository: repository,
	}
}

func (s *testService) GetTestData(ctx context.Context, dateFrom, dateTo string, page, pageSize int) ([]map[string]interface{}, error) {
	return s.repository.GetTestData(ctx, dateFrom, dateTo, page, pageSize)
}
