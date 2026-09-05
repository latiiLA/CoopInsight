package service

import (
	"context"
	"crypto/subtle"
	"fmt"
	"strings"
	"time"

	"github.com/go-ldap/ldap/v3"
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
	Register(ctx context.Context, createdBy primitive.ObjectID, req *dto.RegisterRequest) error
	GetUserDetails(ctx context.Context, username string) (*dto.UserResponse, error)
	GetByID(ctx context.Context, userID primitive.ObjectID) (*model.User, error)
	GetAll(ctx context.Context) ([]model.User, error)
	Update(ctx context.Context, updatedBy primitive.ObjectID, userID primitive.ObjectID, req *dto.UpdateUserRequest) error
}

type userService struct {
	userRepository repository.UserRepository
	roleRepository repository.RoleRepository
	host           string
	port           string
	basedDN        string
	bindUser       string
	bindPassword   string
	userFilter     string
}

func NewUserService(
	userRepository repository.UserRepository,
	roleRepository repository.RoleRepository,
	host, port, baseDN, bindUser, bindPassword, userFilter string,
) UserService {
	return &userService{
		userRepository: userRepository,
		roleRepository: roleRepository,
		host:           host,
		port:           port,
		basedDN:        baseDN,
		bindUser:       bindUser,
		bindPassword:   bindPassword,
		userFilter:     userFilter,
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
	defer l.Close()

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

	return s.issueLoginResponse(ctx, existingUser, ip)
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

	return s.issueLoginResponse(ctx, existingUser, ip)
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

	return existingUser, nil
}

func (s *userService) issueLoginResponse(ctx context.Context, existingUser *model.User, ip string) (*dto.LoginResponse, error) {
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

	refreshToken, err := auth.GenerateRefreshToken(existingUser.ID, ip)
	if err != nil {
		return nil, err
	}

	return &dto.LoginResponse{
		User: model.User{
			ID:         existingUser.ID,
			FirstName:  existingUser.FirstName,
			MiddleName: existingUser.MiddleName,
			Username:   existingUser.Username,
			Email:      existingUser.Email,
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
	l, err := ldap.DialURL(fmt.Sprintf("ldap://%s:%s", s.host, s.port))
	if err != nil {
		return nil, err
	}
	defer l.Close()

	// Bind with Service Account
	err = l.Bind(s.bindUser, s.bindPassword)
	if err != nil {
		return nil, err
	}

	// Search for the user
	searchRequest := ldap.NewSearchRequest(
		s.basedDN,
		ldap.ScopeWholeSubtree, ldap.NeverDerefAliases, 0, 0, false,
		fmt.Sprintf("(%s=%s)", s.userFilter, username), // Use sAMAccountName for real AD
		[]string{"dn", "givenName", "name", "sn", "mail", "userAccountControl"},
		// []string{"*"}, // used for debug to fetch all the data
		nil,
	)

	sr, err := l.Search(searchRequest)
	if err != nil || len(sr.Entries) == 0 {
		return nil, common.ErrADUserNotFound
	}

	entry := sr.Entries[0]

	// log.Println("===== LDAP ATTRIBUTES DUMP =====")

	// for _, attr := range entry.Attributes {
	// 	log.Printf("Attribute: %s\n", attr.Name)
	// 	for i, val := range attr.Values {
	// 		log.Printf("   Value[%d]: %s\n", i, val)
	// 	}
	// }

	// log.Println("================================")

	user := &dto.UserResponse{
		// DisplayName: entry.GetAttributeValue("name"),
		FirstName:  entry.GetAttributeValue("givenName"),
		MiddleName: entry.GetAttributeValue("sn"),
		Email:      entry.GetAttributeValue("mail"),
	}
	return user, nil
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

func (s *userService) Register(ctx context.Context, createdBy primitive.ObjectID, req *dto.RegisterRequest) error {
	username := strings.ToLower(strings.TrimSpace(req.Username))

	existing, err := s.userRepository.FindByUsername(ctx, username)
	if err != nil {
		return err
	}
	if existing != nil {
		return common.ErrUsernameAlreadyExists
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
	if email == "" {
		if adUser, adErr := s.GetUserDetails(ctx, username); adErr == nil && adUser != nil {
			email = adUser.Email
		}
	}

	now := time.Now()
	permissions := req.Permissions
	if permissions == nil {
		permissions = []string{}
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

	return s.userRepository.Create(ctx, user)
}
