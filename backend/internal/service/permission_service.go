package service

import (
	"context"
	"strings"
	"time"

	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/dto"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PermissionService interface {
	GetAll(ctx context.Context) ([]model.Permission, error)
	GetByID(ctx context.Context, permissionID primitive.ObjectID) (*model.Permission, error)
	Create(ctx context.Context, createdBy primitive.ObjectID, req *dto.CreatePermissionRequest) error
	Update(ctx context.Context, updatedBy primitive.ObjectID, permissionID primitive.ObjectID, req *dto.UpdatePermissionRequest) error
	Delete(ctx context.Context, deletedBy primitive.ObjectID, permissionID primitive.ObjectID) error
}

type permissionService struct {
	permissionRepository repository.PermissionRepository
	roleRepository       repository.RoleRepository
	userRepository       repository.UserRepository
}

func NewPermissionService(
	permissionRepository repository.PermissionRepository,
	roleRepository repository.RoleRepository,
	userRepository repository.UserRepository,
) PermissionService {
	return &permissionService{
		permissionRepository: permissionRepository,
		roleRepository:       roleRepository,
		userRepository:       userRepository,
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

func (s *permissionService) GetByID(ctx context.Context, permissionID primitive.ObjectID) (*model.Permission, error) {
	permission, err := s.permissionRepository.FindByID(ctx, permissionID)
	if err != nil {
		return nil, err
	}
	if permission == nil {
		return nil, common.ErrPermissionNotFound
	}

	assigned, err := s.isAssigned(ctx, permission.Name)
	if err != nil {
		return nil, err
	}

	permission.Assigned = assigned
	return permission, nil
}

func (s *permissionService) Create(ctx context.Context, createdBy primitive.ObjectID, req *dto.CreatePermissionRequest) error {
	name := strings.ToLower(strings.TrimSpace(req.Name))
	resource := strings.ToLower(strings.TrimSpace(req.Resource))
	action := strings.ToLower(strings.TrimSpace(req.Action))
	description := strings.TrimSpace(req.Description)

	existing, err := s.permissionRepository.FindByName(ctx, name)
	if err != nil {
		return err
	}
	if existing != nil {
		return common.ErrPermissionAlreadyExists
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

func (s *permissionService) Update(ctx context.Context, updatedBy primitive.ObjectID, permissionID primitive.ObjectID, req *dto.UpdatePermissionRequest) error {
	existing, err := s.GetByID(ctx, permissionID)
	if err != nil {
		return err
	}

	name := strings.ToLower(strings.TrimSpace(req.Name))
	resource := strings.ToLower(strings.TrimSpace(req.Resource))
	action := strings.ToLower(strings.TrimSpace(req.Action))
	description := strings.TrimSpace(req.Description)

	if existing.Assigned && name != existing.Name {
		return common.ErrPermissionInUse
	}

	if name != existing.Name {
		other, err := s.permissionRepository.FindByName(ctx, name)
		if err != nil {
			return err
		}
		if other != nil && other.ID != permissionID {
			return common.ErrPermissionAlreadyExists
		}

		existing.Name = name
		existing.Resource = resource
		existing.Action = action
	} else if !existing.Assigned {
		existing.Resource = resource
		existing.Action = action
	}

	existing.Description = description
	existing.UpdatedAt = time.Now()
	existing.UpdatedBy = &updatedBy

	return s.permissionRepository.Update(ctx, existing)
}

func (s *permissionService) Delete(ctx context.Context, deletedBy primitive.ObjectID, permissionID primitive.ObjectID) error {
	existing, err := s.GetByID(ctx, permissionID)
	if err != nil {
		return err
	}

	if existing.Assigned {
		return common.ErrPermissionInUse
	}

	now := time.Now()
	existing.Status = model.PermissionStatusDeleted
	existing.DeletedAt = &now
	existing.DeletedBy = &deletedBy
	existing.UpdatedAt = now

	return s.permissionRepository.Delete(ctx, existing)
}

func (s *permissionService) isAssigned(ctx context.Context, name string) (bool, error) {
	roleCount, err := s.roleRepository.CountByPermission(ctx, name)
	if err != nil {
		return false, err
	}
	if roleCount > 0 {
		return true, nil
	}

	userCount, err := s.userRepository.CountByPermission(ctx, name)
	if err != nil {
		return false, err
	}

	return userCount > 0, nil
}
