package auth

import (
	"testing"
	"time"
)

func TestGenerateTokenCreatesUniqueJTI(t *testing.T) {
	first, err := GenerateToken(1, "admin", 0, "secret")
	if err != nil {
		t.Fatal(err)
	}
	second, err := GenerateToken(1, "admin", 0, "secret")
	if err != nil {
		t.Fatal(err)
	}

	a, err := ParseClaims(first, "secret")
	if err != nil {
		t.Fatal(err)
	}
	b, err := ParseClaims(second, "secret")
	if err != nil {
		t.Fatal(err)
	}
	if a.JTI == "" || b.JTI == "" {
		t.Fatal("token has no jti")
	}
	if a.JTI == b.JTI {
		t.Fatal("tokens reused the same jti")
	}
}

func TestExpiredTokenIsRejected(t *testing.T) {
	token, err := GenerateTokenAt(1, "admin", 0, "secret", time.Now().Add(-8*24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := ValidateToken(token, "secret"); ok {
		t.Fatal("expired token was accepted")
	}
}
