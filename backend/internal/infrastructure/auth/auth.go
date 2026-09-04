package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/latiiLA/CoopInsight/backend/configs"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func GenerateToken(userID primitive.ObjectID, role string, permissions []string, ip string) (string, error) {
	claims := jwt.MapClaims{
		"userId":      userID.Hex(),
		"role":        role,
		"permissions": permissions,
		"ip":          ip,
		"exp":         time.Now().Add(configs.AccessTokenExpiry).Unix(), // expiration
		"iat":         time.Now().Unix(),                                // issued at
		"iss":         "switch-hub",                                     // issuer
		"sub":         userID.Hex(),                                     // subject
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(configs.JwtSecret))
}

func ValidateToken(tokenString string, clientIP string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(configs.JwtSecret), nil
	})

	if err != nil || !token.Valid {
		return nil, errors.New("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("user ID missing in token")
	}

	// Check if user ID exists
	tokenUserID, exists := claims["userId"].(string)
	if !exists || tokenUserID == "" {
		return nil, errors.New("userId missing in token")
	}

	// --- IP validation ---
	tokenIP, ok := claims["ip"].(string)
	if ok {
		// Allow localhost variations
		if clientIP != tokenIP && clientIP != "::1" && clientIP != "127.0.0.1" {
			return nil, errors.New("IP does not match the token")
		}
	}

	return claims, nil
}

func GenerateRefreshToken(userID primitive.ObjectID, ip string) (string, error) {
	// Get JWT secret from environment variable
	secret := configs.RefreshJwtSecret
	if secret == "" {
		return "", fmt.Errorf("REFRESH_JWT_SECRET environment variable is not set")
	}

	// Set expiration time (e.g., 7 days)
	expirationTime := time.Now().Add(7 * 24 * time.Hour)

	// Use MapClaims to match your access token style
	claims := jwt.MapClaims{
		"userId": userID.Hex(),
		"ip":     ip, // optional
		"exp":    expirationTime.Unix(),
		"iat":    time.Now().Unix(),
		"nbf":    time.Now().Unix(),
		"iss":    "switch-hub",
		"sub":    userID.Hex(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", fmt.Errorf("failed to sign refresh token: %w", err)
	}

	return tokenString, nil
}

func ValidateRefreshToken(tokenString string, clientIP string) (jwt.MapClaims, error) {
	secret := configs.RefreshJwtSecret
	if secret == "" {
		return nil, fmt.Errorf("REFRESH_JWT_SECRET environment variable is not set")
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(secret), nil
	})

	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid claims in token")
	}

	// Check if userID exists
	tokenUserID, exists := claims["userId"].(string)
	if !exists || tokenUserID == "" {
		return nil, fmt.Errorf("userId missing in token")
	}

	// --- Optional IP validation ---
	tokenIP, ok := claims["ip"].(string)
	if ok {
		// Allow localhost variations
		if clientIP != tokenIP && clientIP != "::1" && clientIP != "127.0.0.1" {
			return nil, fmt.Errorf("IP does not match token")
		}
	}

	// Check expiration
	if exp, ok := claims["exp"].(float64); ok {
		if time.Now().Unix() > int64(exp) {
			return nil, fmt.Errorf("token expired")
		}
	}

	return claims, nil
}
