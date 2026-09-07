package service

import (
	"context"
	"crypto/subtle"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/go-ldap/ldap/v3"
	"github.com/latiiLA/CoopInsight/backend/configs"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/dto"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/auth"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/utils"
	"github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

type UserService interface {
	Authenticate(ctx context.Context, username, password, ip string) (*dto.LoginResponse, error)
	AuthenticateLocal(ctx context.Context, username, password, ip string) (*dto.LoginResponse, error)
	RefreshSession(ctx context.Context, refreshToken, ip string) (*dto.LoginResponse, error)
	Register(ctx context.Context, createdBy primitive.ObjectID, req *dto.RegisterRequest) error
	RequestAccount(ctx context.Context, req *dto.RequestAccountRequest) error
	ListAccountRequests(ctx context.Context) ([]model.AccountRequest, error)
	GetAccountRequest(ctx context.Context, id primitive.ObjectID) (*model.AccountRequest, error)
	GetUserDetails(ctx context.Context, username string) (*dto.UserResponse, error)
	GetByID(ctx context.Context, userID primitive.ObjectID) (*model.User, error)
	GetAll(ctx context.Context) ([]model.User, error)
	Update(ctx context.Context, updatedBy primitive.ObjectID, userID primitive.ObjectID, req *dto.UpdateUserRequest) error
	UpdateAvatar(ctx context.Context, userID primitive.ObjectID, avatar string) error
	UploadAvatarPhoto(ctx context.Context, userID primitive.ObjectID, data []byte) (string, error)
	UpdateProfile(ctx context.Context, userID primitive.ObjectID, req *dto.UpdateProfileRequest) (*model.UserProfile, error)
}

type userService struct {
	userRepository           repository.UserRepository
	roleRepository           repository.RoleRepository
	accountRequestRepository repository.AccountRequestRepository
	host                     string
	port                     string
	basedDN                  string
	bindUser                 string
	bindPassword             string
	userFilter               string
}

func NewUserService(
	userRepository repository.UserRepository,
	roleRepository repository.RoleRepository,
	accountRequestRepository repository.AccountRequestRepository,
	host, port, baseDN, bindUser, bindPassword, userFilter string,
) UserService {
	return &userService{
		userRepository:           userRepository,
		roleRepository:           roleRepository,
		accountRequestRepository: accountRequestRepository,
		host:                     host,
		port:                     port,
		basedDN:                  baseDN,
		bindUser:                 bindUser,
		bindPassword:             bindPassword,
		userFilter:               userFilter,
	}
}

func (s *userService) Authenticate(ctx context.Context, username, password, ip string) (*dto.LoginResponse, error) {
	existingUser, err := s.findEligibleUser(ctx, username)
	if err != nil {
		return nil, err
	}

	l, err := ldap.DialURL(fmt.Sprintf("ldap://%s", s.host))
	if err != nil {
		logrus.Println("LDAP: Connection failed")
		return nil, fmt.Errorf("failed to connect to LDAP: %w", err)
	}
	defer func() { _ = l.Close() }()

	// Search for user DN
	searchRequest := ldap.NewSearchRequest(
		s.basedDN,
		ldap.ScopeWholeSubtree, ldap.NeverDerefAliases, 0, 0, false,
		fmt.Sprintf("(%s=%s)", s.userFilter, username),
		[]string{"dn"},
		nil,
	)

	// Bind with service account
	err = l.Bind(s.bindUser, s.bindPassword)
	if err != nil {
		logrus.Println(fmt.Errorf("bind failed: %w", err))
		return nil, fmt.Errorf("bind failed: %w", err)
	}
	logrus.Println("LDAP: Initial bind successful")

	sr, err := l.Search(searchRequest)
	if err != nil {
		logrus.Println(fmt.Errorf("LDAP search error: %w", err))
		return nil, fmt.Errorf("LDAP search error: %w", err)
	}
	if len(sr.Entries) == 0 {
		logrus.Println(fmt.Errorf("user not found"))
		return nil, common.ErrADUserNotFound
	}

	userDN := sr.Entries[0].DN
	logrus.Printf("LDAP: Found user DN = %s\n", userDN)

	// Try binding as the user with the provided password
	err = l.Bind(userDN, password)
	if err != nil {
		logrus.Println(fmt.Errorf("user authentication failed: %w", err))
		return nil, common.ErrInvalidCredentials
	}
	logrus.Println("✅ User authentication successful")

	return s.issueSessionResponse(ctx, existingUser, ip, "")
}

func (s *userService) AuthenticateLocal(ctx context.Context, username, password, ip string) (*dto.LoginResponse, error) {
	existingUser, err := s.findEligibleUser(ctx, username)
	if err != nil {
		return nil, err
	}

	if !passwordMatches(existingUser.Password, password) {
		logrus.Println("local authentication failed: invalid password")
		return nil, common.ErrInvalidCredentials
	}

	logrus.Println("local user authentication successful")

	return s.issueSessionResponse(ctx, existingUser, ip, "")
}

func (s *userService) RefreshSession(ctx context.Context, refreshToken, ip string) (*dto.LoginResponse, error) {
	claims, err := auth.ValidateRefreshToken(refreshToken, ip)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", common.ErrInvalidRefreshToken, err)
	}

	userIDHex, _ := claims["userId"].(string)
	userID, err := primitive.ObjectIDFromHex(userIDHex)
	if err != nil {
		return nil, common.ErrInvalidRefreshToken
	}

	existingUser, err := s.userRepository.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if existingUser == nil {
		return nil, common.ErrUserNotFound
	}

	if existingUser.Status != model.StatusNew && existingUser.Status != model.StatusActive {
		return nil, common.ErrUserAccessRevoked
	}

	if !existingUser.HasAssignedRole() {
		return nil, common.ErrAccountPendingApproval
	}

	return s.issueSessionResponse(ctx, existingUser, ip, refreshToken)
}

func (s *userService) findEligibleUser(ctx context.Context, username string) (*model.User, error) {
	existingUser, err := s.userRepository.FindByUsername(ctx, username)
	if err != nil {
		return nil, err
	}
	if existingUser == nil {
		return nil, common.ErrUserNotFound
	}

	if existingUser.Status != model.StatusNew && existingUser.Status != model.StatusActive {
		logrus.Println("user access has been revoked")
		return nil, common.ErrUserAccessRevoked
	}

	if !existingUser.HasAssignedRole() {
		return nil, common.ErrAccountPendingApproval
	}

	return existingUser, nil
}

func (s *userService) issueSessionResponse(ctx context.Context, existingUser *model.User, ip, existingRefreshToken string) (*dto.LoginResponse, error) {
	role := existingUser.Role
	if !existingUser.RoleID.IsZero() {
		fetchedRole, err := s.roleRepository.FindByID(ctx, existingUser.RoleID)
		if err != nil {
			return nil, err
		}

		if fetchedRole != nil {
			role = fetchedRole
			existingUser.Role = fetchedRole
		}
	}

	var roleName string
	var rolePerms []string

	if role != nil {
		roleName = role.Name
		rolePerms = role.Permissions
	}

	effectivePerms := utils.MergePermissions(rolePerms, existingUser.Permissions)

	accessToken, err := auth.GenerateToken(existingUser.ID, roleName, effectivePerms, ip)
	if err != nil {
		return nil, err
	}

	refreshToken := existingRefreshToken
	if refreshToken == "" {
		refreshToken, err = auth.GenerateRefreshToken(existingUser.ID, ip)
		if err != nil {
			return nil, err
		}
	}

	avatar := existingUser.Avatar
	if avatar != "" && !model.IsAllowedAvatar(avatar) && !model.IsPhotoAvatar(avatar) {
		avatar = ""
	}

	return &dto.LoginResponse{
		User: model.User{
			ID:         existingUser.ID,
			FirstName:  existingUser.FirstName,
			MiddleName: existingUser.MiddleName,
			LastName:   existingUser.LastName,
			Username:   existingUser.Username,
			Email:      existingUser.Email,
			Avatar:     avatar,
			Profile:    existingUser.Profile,
			Role:       existingUser.Role,
		},
		Token:        accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func passwordMatches(stored, provided string) bool {
	if stored == "" || provided == "" {
		return false
	}

	if strings.HasPrefix(stored, "$2a$") || strings.HasPrefix(stored, "$2b$") || strings.HasPrefix(stored, "$2y$") {
		return bcrypt.CompareHashAndPassword([]byte(stored), []byte(provided)) == nil
	}

	if len(stored) != len(provided) {
		return false
	}

	return subtle.ConstantTimeCompare([]byte(stored), []byte(provided)) == 1
}

// Inside your LDAP service
func (s *userService) GetUserDetails(ctx context.Context, username string) (*dto.UserResponse, error) {
	username = strings.TrimSpace(username)
	if username == "" {
		return nil, common.ErrADUserNotFound
	}

	l, err := ldap.DialURL(fmt.Sprintf("ldap://%s:%s", s.host, s.port))
	if err != nil {
		logrus.WithError(err).Warn("LDAP: connection failed")
		return nil, fmt.Errorf("%w: %v", common.ErrADUnavailable, err)
	}
	defer func() { _ = l.Close() }()

	if err := l.Bind(s.bindUser, s.bindPassword); err != nil {
		logrus.WithError(err).Warn("LDAP: bind failed")
		return nil, fmt.Errorf("%w: %v", common.ErrADUnavailable, err)
	}

	filter := fmt.Sprintf(
		"(&(objectClass=user)(%s=%s))",
		s.userFilter,
		ldap.EscapeFilter(username),
	)

	searchRequest := ldap.NewSearchRequest(
		s.basedDN,
		ldap.ScopeWholeSubtree, ldap.NeverDerefAliases, 1, 0, false,
		filter,
		[]string{"dn", "givenName", "name", "sn", "mail", s.userFilter, "sAMAccountName"},
		nil,
	)

	sr, err := l.Search(searchRequest)
	if err != nil {
		logrus.WithError(err).WithField("username", username).Warn("LDAP: search failed")
		return nil, fmt.Errorf("%w: %v", common.ErrADUnavailable, err)
	}
	if sr == nil || len(sr.Entries) == 0 {
		logrus.WithField("username", username).Warn("LDAP: username does not exist")
		return nil, common.ErrADUserNotFound
	}

	entry := sr.Entries[0]
	accountName := entry.GetAttributeValue(s.userFilter)
	if accountName == "" {
		accountName = entry.GetAttributeValue("sAMAccountName")
	}
	if !strings.EqualFold(accountName, username) {
		logrus.WithFields(logrus.Fields{
			"username":    username,
			"accountName": accountName,
		}).Warn("LDAP: username does not match AD account")
		return nil, common.ErrADUserNotFound
	}

	return &dto.UserResponse{
		FirstName:  entry.GetAttributeValue("givenName"),
		MiddleName: entry.GetAttributeValue("sn"),
		Email:      entry.GetAttributeValue("mail"),
	}, nil
}

func (s *userService) GetByID(ctx context.Context, userID primitive.ObjectID) (*model.User, error) {
	user, err := s.userRepository.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, common.ErrUserNotFound
	}

	return user, nil
}

func (s *userService) GetAll(ctx context.Context) ([]model.User, error) {
	return s.userRepository.FindAll(ctx)
}

func (s *userService) Update(ctx context.Context, updatedBy primitive.ObjectID, userID primitive.ObjectID, req *dto.UpdateUserRequest) error {
	existing, err := s.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	roleID, err := primitive.ObjectIDFromHex(req.Role)
	if err != nil {
		return common.ErrRoleNotFound
	}

	role, err := s.roleRepository.FindByID(ctx, roleID)
	if err != nil {
		return err
	}
	if role == nil {
		return common.ErrRoleNotFound
	}

	permissions := req.Permissions
	if permissions == nil {
		permissions = []string{}
	}

	now := time.Now()
	existing.FirstName = strings.TrimSpace(req.FirstName)
	existing.MiddleName = strings.TrimSpace(req.MiddleName)
	existing.LastName = strings.TrimSpace(req.LastName)
	existing.Email = strings.ToLower(strings.TrimSpace(req.Email))
	existing.RoleID = roleID
	existing.Permissions = permissions
	existing.Status = model.UserStatus(req.Status)
	existing.UpdatedAt = now
	existing.UpdatedBy = &updatedBy

	return s.userRepository.Update(ctx, existing)
}

func (s *userService) UpdateAvatar(ctx context.Context, userID primitive.ObjectID, avatar string) error {
	normalized, ok := model.NormalizeAvatarChoice(avatar)
	if !ok {
		return common.ErrInvalidAvatar
	}

	if _, err := s.GetByID(ctx, userID); err != nil {
		return err
	}

	removeUserAvatarFiles(userID)

	return s.userRepository.UpdateAvatar(ctx, userID, normalized, time.Now())
}

func (s *userService) UploadAvatarPhoto(ctx context.Context, userID primitive.ObjectID, data []byte) (string, error) {
	if _, err := s.GetByID(ctx, userID); err != nil {
		return "", err
	}

	ext, ok := model.ImageExtension(data)
	if !ok {
		return "", common.ErrInvalidAvatarFile
	}

	dir := filepath.Join(configs.FileUploadPath, "avatars")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("%w: %v", common.ErrFailedToUpdateUser, err)
	}

	removeUserAvatarFiles(userID)

	filename := fmt.Sprintf("%s-%d.%s", userID.Hex(), time.Now().Unix(), ext)
	absPath := filepath.Join(dir, filename)
	if err := os.WriteFile(absPath, data, 0o644); err != nil {
		return "", fmt.Errorf("%w: %v", common.ErrFailedToUpdateUser, err)
	}

	publicPath := "/uploads/avatars/" + filename
	if err := s.userRepository.UpdateAvatar(ctx, userID, publicPath, time.Now()); err != nil {
		_ = os.Remove(absPath)
		return "", err
	}

	return publicPath, nil
}

func (s *userService) UpdateProfile(ctx context.Context, userID primitive.ObjectID, req *dto.UpdateProfileRequest) (*model.UserProfile, error) {
	if req == nil {
		return nil, common.ErrInvalidProfile
	}

	if _, err := s.GetByID(ctx, userID); err != nil {
		return nil, err
	}

	profile, ok := model.NormalizeProfile(req.JobTitle, req.Department, req.Branch, req.Phone, req.Bio)
	if !ok {
		return nil, common.ErrInvalidProfile
	}

	if err := s.userRepository.UpdateProfile(ctx, userID, profile, time.Now()); err != nil {
		return nil, err
	}

	return &profile, nil
}

func removeUserAvatarFiles(userID primitive.ObjectID) {
	matches, err := filepath.Glob(filepath.Join(configs.FileUploadPath, "avatars", userID.Hex()+"*"))
	if err != nil {
		return
	}

	for _, match := range matches {
		_ = os.Remove(match)
	}
}

func (s *userService) Register(ctx context.Context, createdBy primitive.ObjectID, req *dto.RegisterRequest) error {
	username := strings.ToLower(strings.TrimSpace(req.Username))

	adUser, err := s.GetUserDetails(ctx, username)
	if err != nil {
		return err
	}

	roleID, err := primitive.ObjectIDFromHex(req.Role)
	if err != nil {
		return common.ErrRoleNotFound
	}

	role, err := s.roleRepository.FindByID(ctx, roleID)
	if err != nil {
		return err
	}
	if role == nil {
		return common.ErrRoleNotFound
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" && adUser != nil {
		email = adUser.Email
	}

	now := time.Now()
	permissions := req.Permissions
	if permissions == nil {
		permissions = []string{}
	}

	var accountRequest *model.AccountRequest
	var stubUser *model.User
	if strings.TrimSpace(req.RequestID) != "" {
		requestID, parseErr := primitive.ObjectIDFromHex(strings.TrimSpace(req.RequestID))
		if parseErr != nil {
			return common.ErrAccountRequestNotFound
		}

		accountRequest, err = s.accountRequestRepository.FindByID(ctx, requestID)
		if err != nil {
			return err
		}
		if accountRequest != nil && accountRequest.Status != model.AccountRequestPending {
			return common.ErrAccountRequestAlreadyHandled
		}
		if accountRequest == nil {
			stubUser, err = s.userRepository.FindByID(ctx, requestID)
			if err != nil {
				return err
			}
			if stubUser == nil || stubUser.HasAssignedRole() || stubUser.Status == model.StatusDeleted {
				return common.ErrAccountRequestNotFound
			}
		}
	}

	existing, err := s.userRepository.FindByUsername(ctx, username)
	if err != nil {
		return err
	}
	if existing != nil && (stubUser == nil || existing.ID != stubUser.ID) {
		return common.ErrUsernameAlreadyExists
	}

	if stubUser != nil {
		stubUser.FirstName = strings.TrimSpace(req.FirstName)
		stubUser.MiddleName = strings.TrimSpace(req.MiddleName)
		stubUser.LastName = strings.TrimSpace(req.LastName)
		stubUser.Email = email
		stubUser.RoleID = roleID
		stubUser.Permissions = permissions
		stubUser.Username = username
		stubUser.UpdatedAt = now
		stubUser.UpdatedBy = &createdBy

		return s.userRepository.Update(ctx, stubUser)
	}

	user := &model.User{
		ID:          primitive.NewObjectID(),
		FirstName:   strings.TrimSpace(req.FirstName),
		MiddleName:  strings.TrimSpace(req.MiddleName),
		LastName:    strings.TrimSpace(req.LastName),
		Email:       email,
		RoleID:      roleID,
		Permissions: permissions,
		Username:    username,
		Status:      model.StatusNew,
		CreatedAt:   now,
		UpdatedAt:   now,
		CreatedBy:   createdBy,
	}

	if err := s.userRepository.Create(ctx, user); err != nil {
		return err
	}

	if accountRequest != nil {
		if err := s.accountRequestRepository.Fulfill(ctx, accountRequest.ID, createdBy, user.ID, now); err != nil {
			return err
		}
	}

	return nil
}

func (s *userService) RequestAccount(ctx context.Context, req *dto.RequestAccountRequest) error {
	username := strings.ToLower(strings.TrimSpace(req.Username))

	existing, err := s.userRepository.FindByUsername(ctx, username)
	if err != nil {
		return err
	}
	if existing != nil {
		return common.ErrUsernameAlreadyExists
	}

	pending, err := s.accountRequestRepository.FindPendingByUsername(ctx, username)
	if err != nil {
		return err
	}
	if pending != nil {
		return common.ErrUsernameAlreadyExists
	}

	if _, err := s.GetUserDetails(ctx, username); err != nil {
		return err
	}

	now := time.Now()
	request := &model.AccountRequest{
		ID:         primitive.NewObjectID(),
		Username:   username,
		FirstName:  strings.TrimSpace(req.FirstName),
		MiddleName: strings.TrimSpace(req.MiddleName),
		LastName:   strings.TrimSpace(req.LastName),
		Email:      strings.ToLower(strings.TrimSpace(req.Email)),
		Status:     model.AccountRequestPending,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	return s.accountRequestRepository.Create(ctx, request)
}

func accountRequestFromUser(user *model.User) model.AccountRequest {
	return model.AccountRequest{
		ID:         user.ID,
		Username:   user.Username,
		FirstName:  user.FirstName,
		MiddleName: user.MiddleName,
		LastName:   user.LastName,
		Email:      user.Email,
		Status:     model.AccountRequestPending,
		CreatedAt:  user.CreatedAt,
		UpdatedAt:  user.UpdatedAt,
	}
}

func (s *userService) ListAccountRequests(ctx context.Context) ([]model.AccountRequest, error) {
	requests, err := s.accountRequestRepository.FindPending(ctx)
	if err != nil {
		return nil, err
	}
	if requests == nil {
		requests = []model.AccountRequest{}
	}

	pendingUsernames := make(map[string]struct{}, len(requests))
	for _, request := range requests {
		pendingUsernames[request.Username] = struct{}{}
	}

	stubs, err := s.userRepository.FindUnassignedNew(ctx)
	if err != nil {
		return nil, err
	}

	for i := range stubs {
		if stubs[i].HasAssignedRole() {
			continue
		}
		if _, exists := pendingUsernames[stubs[i].Username]; exists {
			continue
		}

		requests = append(requests, accountRequestFromUser(&stubs[i]))
	}

	sort.Slice(requests, func(i, j int) bool {
		return requests[i].CreatedAt.After(requests[j].CreatedAt)
	})

	return requests, nil
}

func (s *userService) GetAccountRequest(ctx context.Context, id primitive.ObjectID) (*model.AccountRequest, error) {
	request, err := s.accountRequestRepository.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if request != nil {
		return request, nil
	}

	user, err := s.userRepository.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if user == nil || user.HasAssignedRole() || user.Status == model.StatusDeleted {
		return nil, common.ErrAccountRequestNotFound
	}

	converted := accountRequestFromUser(user)
	return &converted, nil
}
