package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/dto"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type PermissionService interface {
	GetAll(ctx context.Context) ([]model.Permission, error)
	Create(ctx context.Context, createdBy primitive.ObjectID, req *dto.CreatePermissionRequest) error
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

func (s *permissionService) Create(ctx context.Context, createdBy primitive.ObjectID, req *dto.CreatePermissionRequest) error {
	name := strings.ToLower(strings.TrimSpace(req.Name))
	resource := strings.ToLower(strings.TrimSpace(req.Resource))
	action := strings.ToLower(strings.TrimSpace(req.Action))
	description := strings.TrimSpace(req.Description)

	_, err := s.permissionRepository.FindByName(ctx, name)
	if err == nil {
		return common.ErrPermissionAlreadyExists
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		return err
	}

	now := time.Now()
	permission := &model.Permission{
		ID:          primitive.NewObjectID(),
		Name:        name,
		Resource:    resource,
		Action:      action,
		Description: description,
		Status:      model.PermissionStatusActive,
		CreatedAt:   now,
		UpdatedAt:   now,
		CreatedBy:   createdBy,
	}

	return s.permissionRepository.Create(ctx, permission)
}
