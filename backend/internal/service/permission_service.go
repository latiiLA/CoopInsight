package service

import (
	"context"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
)

type PermissionService interface {
	GetAll(ctx context.Context) ([]model.Permission, error)
}

type permissionService struct {
	permissionRepository repository.PermissionRepository
}

func NewPermissionService(permissionRepository repository.PermissionRepository) PermissionService {
	return &permissionService{
		permissionRepository: permissionRepository,
	}
}

func (s *permissionService) GetAll(ctx context.Context) ([]model.Permission, error) {
	permissions, err := s.permissionRepository.FindAll(ctx)
	if err != nil {
		return nil, err
	}

	if permissions == nil {
		return []model.Permission{}, nil
	}

	return permissions, nil
}
