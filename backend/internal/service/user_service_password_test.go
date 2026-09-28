package service

import (
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestPasswordMatchesRequiresBcrypt(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("secret"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}

	if !passwordMatches(string(hash), "secret") {
		t.Fatal("expected bcrypt hash to match")
	}
	if passwordMatches(string(hash), "wrong") {
		t.Fatal("expected wrong password to fail")
	}
	if passwordMatches("plaintext-secret", "plaintext-secret") {
		t.Fatal("plaintext stored password must be rejected")
	}
	if passwordMatches("", "secret") {
		t.Fatal("empty stored password must be rejected")
	}
}
