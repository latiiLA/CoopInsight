package service

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

type AtmTerminalService interface {
	GetAll(ctx context.Context) ([]model.AtmTerminal, error)
}

type atmTerminalService struct {
	repository repository.AtmTerminalRepository
}

func NewAtmTerminalService(repository repository.AtmTerminalRepository) AtmTerminalService {
	return &atmTerminalService{
		repository: repository,
	}
}

func (s *atmTerminalService) GetAll(ctx context.Context) ([]model.AtmTerminal, error) {
	if s.repository == nil {
		return nil, common.ErrSourceMongoUnavailable
	}

	terminals, err := s.repository.FindAll(ctx)
	if err != nil {
		return nil, err
	}

	if terminals == nil {
		return []model.AtmTerminal{}, nil
	}

	return terminals, nil
}
