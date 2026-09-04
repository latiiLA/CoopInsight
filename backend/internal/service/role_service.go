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

type RoleService interface {
	GetAll(ctx context.Context) ([]model.Role, error)
	Create(ctx context.Context, createdBy primitive.ObjectID, req *dto.CreateRoleRequest) error
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

func (s *roleService) Create(ctx context.Context, createdBy primitive.ObjectID, req *dto.CreateRoleRequest) error {
	name := strings.TrimSpace(req.Name)

	_, err := s.roleRepository.FindByName(ctx, name)
	if err == nil {
		return common.ErrRoleNameAlreadyExists
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		return err
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
		Status:      "active",
		CreatedAt:   now,
		UpdatedAt:   now,
		CreatedBy:   createdBy,
	}

	return s.roleRepository.Create(ctx, role)
}
