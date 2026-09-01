package service

import (
	"context"
	"fmt"

	"github.com/go-ldap/ldap/v3"
	"github.com/latiiLA/CoopInsight/backend/internal/common"
	"github.com/latiiLA/CoopInsight/backend/internal/delivery/dto"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
	"github.com/latiiLA/CoopInsight/backend/internal/domain/repository"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/auth"
	"github.com/latiiLA/CoopInsight/backend/internal/infrastructure/utils"
	"github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/mongo"
)

type UserService interface {
	Authenticate(ctx context.Context, username, password, ip string) (*dto.LoginResponse, error)
	GetUserDetails(ctx context.Context, username string) (*model.User, error)
	GetByID(ctx context.Context, id string) (*model.User, error)
}

type userService struct {
	userRepository repository.UserRepository
	host           string
	port           string
	basedDN        string
	bindUser       string
	bindPassword   string
	userFilter     string
}

func NewUserService(userRepository repository.UserRepository, host, port, baseDN, bindUser, bindPassword, userFilter string) UserService {
	return &userService{
		userRepository: userRepository,
		host:           host,
		port:           port,
		basedDN:        baseDN,
		bindUser:       bindUser,
		bindPassword:   bindPassword,
		userFilter:     userFilter,
	}
}

func (s *userService) Authenticate(ctx context.Context, username, password, ip string) (*dto.LoginResponse, error) {
	// check local database
	existingUser, err := s.userRepository.FindByUsername(ctx, username)
	if err != nil {
		logrus.Println("invalid username or user", err)
		if err == mongo.ErrNoDocuments {
			return nil, common.ErrUserNotFound
		}

		return nil, common.ErrInvalidCredentials
	}

	if existingUser.Status != model.StatusNew && existingUser.Status != model.StatusActive {
		logrus.Println("user status is active", err)
		return nil, common.ErrUserAccessRevoked
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

	// Prepare response and reply
	var perms []string
	if existingUser.Role != nil && existingUser.Permissions != nil {
		perms = existingUser.Permissions
	}

	effectivePerms := utils.MergePermissions(existingUser.Role.Permissions, perms)

	accessToken, err := auth.GenerateToken(existingUser.ID, existingUser.Role.Name, effectivePerms, ip)
	if err != nil {
		return nil, err
	}

	refreshToken, err := auth.GenerateRefreshToken(existingUser.ID, ip)
	if err != nil {
		return nil, err
	}

	response := dto.LoginResponse{
		ID:           existingUser.ID,
		FirstName:    existingUser.FirstName,
		MiddleName:   existingUser.MiddleName,
		Username:     existingUser.Username,
		Email:        existingUser.Email,
		Role:         existingUser.Role.Name,
		Permissions:  effectivePerms,
		Token:        accessToken,
		RefreshToken: refreshToken,
	}

	// Update last login
	// var now = time.Now()
	// if existingUser.Status == model.StatusNew {
	// 	existingUser.Status = model.StatusActive
	// }
	// existingUser.LastLogin = &now
	// existingUser.Updater = nil
	// existingUser.Creator = nil
	// existingUser.Role = nil

	// if _, err := s.userRepository.Update(ctx, existingUser.ID, existingUser); err != nil {
	// 	return nil, fmt.Errorf("user login failed %s", err)
	// }

	return &response, nil
}

// Inside your LDAP service
func (s *userService) GetUserDetails(ctx context.Context, username string) (*model.User, error) {
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

	user := &model.User{
		// DisplayName: entry.GetAttributeValue("name"),
		FirstName:  entry.GetAttributeValue("givenName"),
		MiddleName: entry.GetAttributeValue("sn"),
		Email:      entry.GetAttributeValue("mail"),
	}
	return user, nil
}

func (s *userService) GetByID(ctx context.Context, id string) (*model.User, error) {
	return s.userRepository.GetByID(ctx, id)
}
