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

type RoleService interface {
	GetAll(ctx context.Context) ([]model.Role, error)
	GetByID(ctx context.Context, roleID primitive.ObjectID) (*model.Role, error)
	Create(ctx context.Context, createdBy primitive.ObjectID, req *dto.CreateRoleRequest) error
	Update(ctx context.Context, updatedBy primitive.ObjectID, roleID primitive.ObjectID, req *dto.UpdateRoleRequest) error
}

type roleService struct {
	roleRepository repository.RoleRepository
}

func NewRoleService(roleRepository repository.RoleRepository) RoleService {
	return &roleService{
		roleRepository: roleRepository,
	}
}

func (s *roleService) GetAll(ctx context.Context) ([]model.Role, error) {
	roles, err := s.roleRepository.FindAll(ctx)
	if err != nil {
		return nil, err
	}

	if roles == nil {
		return []model.Role{}, nil
	}

	return roles, nil
}

func (s *roleService) GetByID(ctx context.Context, roleID primitive.ObjectID) (*model.Role, error) {
	role, err := s.roleRepository.FindByID(ctx, roleID)
	if err != nil {
		return nil, err
	}
	if role == nil {
		return nil, common.ErrRoleNotFound
	}

	return role, nil
}

func (s *roleService) Create(ctx context.Context, createdBy primitive.ObjectID, req *dto.CreateRoleRequest) error {
	name := strings.TrimSpace(req.Name)

	existing, err := s.roleRepository.FindByName(ctx, name)
	if err != nil {
		return err
	}
	if existing != nil {
		return common.ErrRoleNameAlreadyExists
	}

	permissions := req.Permissions
	if permissions == nil {
		permissions = []string{}
	}

	now := time.Now()
	role := &model.Role{
		ID:          primitive.NewObjectID(),
		Name:        name,
		Permissions: permissions,
		Status:      model.RoleStatusActive,
		CreatedAt:   now,
		UpdatedAt:   now,
		CreatedBy:   createdBy,
	}

	return s.roleRepository.Create(ctx, role)
}

func (s *roleService) Update(ctx context.Context, updatedBy primitive.ObjectID, roleID primitive.ObjectID, req *dto.UpdateRoleRequest) error {
	existing, err := s.GetByID(ctx, roleID)
	if err != nil {
		return err
	}

	name := strings.TrimSpace(req.Name)

	if strings.EqualFold(existing.Name, "SUPERADMIN") && !strings.EqualFold(name, existing.Name) {
		return common.ErrRoleNameNotAllowed
	}

	other, err := s.roleRepository.FindByName(ctx, name)
	if err != nil {
		return err
	}
	if other != nil && other.ID != roleID {
		return common.ErrRoleNameAlreadyExists
	}

	permissions := req.Permissions
	if permissions == nil {
		permissions = []string{}
	}

	existing.Name = name
	existing.Permissions = permissions
	existing.UpdatedAt = time.Now()
	existing.UpdatedBy = &updatedBy

	return s.roleRepository.Update(ctx, existing)
}
