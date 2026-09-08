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
	Delete(ctx context.Context, deletedBy primitive.ObjectID, roleID primitive.ObjectID) error
}

type roleService struct {
	roleRepository repository.RoleRepository
	userRepository repository.UserRepository
	activityLog    ActivityLogService
}

func NewRoleService(
	roleRepository repository.RoleRepository,
	userRepository repository.UserRepository,
	activityLog ActivityLogService,
) RoleService {
	return &roleService{
		roleRepository: roleRepository,
		userRepository: userRepository,
		activityLog:    activityLog,
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

	if err := s.roleRepository.Create(ctx, role); err != nil {
		return err
	}

	s.recordActivity(ctx, ActivityEvent{
		ActorUserID:   objectIDPtr(createdBy),
		ActorUsername: actorUsername(ctx, s.userRepository, createdBy),
		Action:        model.ActivityRoleCreate,
		ResourceType:  "role",
		ResourceID:    role.ID.Hex(),
		Summary:       "Created role " + name,
		Status:        model.ActivityStatusSuccess,
		Metadata: map[string]interface{}{
			"name": name,
		},
	})
	return nil
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

	if err := s.roleRepository.Update(ctx, existing); err != nil {
		return err
	}

	s.recordActivity(ctx, ActivityEvent{
		ActorUserID:   objectIDPtr(updatedBy),
		ActorUsername: actorUsername(ctx, s.userRepository, updatedBy),
		Action:        model.ActivityRoleUpdate,
		ResourceType:  "role",
		ResourceID:    existing.ID.Hex(),
		Summary:       "Updated role " + name,
		Status:        model.ActivityStatusSuccess,
		Metadata: map[string]interface{}{
			"name": name,
		},
	})
	return nil
}

func (s *roleService) Delete(ctx context.Context, deletedBy primitive.ObjectID, roleID primitive.ObjectID) error {
	existing, err := s.GetByID(ctx, roleID)
	if err != nil {
		return err
	}

	if strings.EqualFold(existing.Name, "SUPERADMIN") {
		return common.ErrRoleNameNotAllowed
	}

	if s.userRepository == nil {
		return common.ErrFailedToDeleteRole
	}

	userCount, err := s.userRepository.CountByRole(ctx, roleID)
	if err != nil {
		return err
	}
	if userCount > 0 {
		return common.ErrRoleInUse
	}

	now := time.Now()
	existing.Status = model.RoleStatusDeleted
	existing.DeletedAt = &now
	existing.DeletedBy = &deletedBy
	existing.UpdatedAt = now

	roleName := existing.Name
	if err := s.roleRepository.Delete(ctx, existing); err != nil {
		return err
	}

	s.recordActivity(ctx, ActivityEvent{
		ActorUserID:   objectIDPtr(deletedBy),
		ActorUsername: actorUsername(ctx, s.userRepository, deletedBy),
		Action:        model.ActivityRoleDelete,
		ResourceType:  "role",
		ResourceID:    existing.ID.Hex(),
		Summary:       "Deleted role " + roleName,
		Status:        model.ActivityStatusSuccess,
		Metadata: map[string]interface{}{
			"name": roleName,
		},
	})
	return nil
}

func (s *roleService) recordActivity(ctx context.Context, event ActivityEvent) {
	if s.activityLog == nil {
		return
	}
	s.activityLog.Record(ctx, event)
}
