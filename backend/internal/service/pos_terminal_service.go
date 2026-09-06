package service

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

type PosTerminalService interface {
	GetAll(ctx context.Context) ([]model.PosTerminal, error)
}

type posTerminalService struct {
	repository repository.PosTerminalRepository
}

func NewPosTerminalService(repository repository.PosTerminalRepository) PosTerminalService {
	return &posTerminalService{
		repository: repository,
	}
}

func (s *posTerminalService) GetAll(ctx context.Context) ([]model.PosTerminal, error) {
	if s.repository == nil {
		return nil, common.ErrSourceMongoUnavailable
	}

	terminals, err := s.repository.FindAll(ctx)
	if err != nil {
		return nil, err
	}

	if terminals == nil {
		return []model.PosTerminal{}, nil
	}

	return terminals, nil
}
