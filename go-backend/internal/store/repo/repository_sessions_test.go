package repo

import (
	"testing"
	"time"
)

func TestUserSessionLifecycle(t *testing.T) {
	r, err := Open(t.TempDir() + "/sessions.db")
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	userID := int64(1)
	expiry := time.Now().Add(time.Hour).Unix()

	valid, err := r.EnsureUserSession(userID, "token-a", "203.0.113.1", "ua-a", expiry)
	if err != nil || !valid {
		t.Fatalf("EnsureUserSession() = %v, %v", valid, err)
	}

	items, err := r.ListUserSessions(userID)
	if err != nil {
		t.Fatalf("ListUserSessions() error = %v", err)
	}
	if len(items) != 1 || items[0].TokenID != "token-a" || items[0].IP != "203.0.113.1" {
		t.Fatalf("unexpected sessions: %+v", items)
	}

	// A second touch must not duplicate the row.
	if _, err := r.EnsureUserSession(userID, "token-a", "203.0.113.1", "ua-a", expiry); err != nil {
		t.Fatal(err)
	}
	items, _ = r.ListUserSessions(userID)
	if len(items) != 1 {
		t.Fatalf("expected one session, got %d", len(items))
	}

	if err := r.RevokeUserSession(userID, items[0].ID); err != nil {
		t.Fatal(err)
	}
	valid, err = r.EnsureUserSession(userID, "token-a", "203.0.113.1", "ua-a", expiry)
	if err != nil {
		t.Fatal(err)
	}
	if valid {
		t.Fatal("revoked session was accepted")
	}
	if items, _ = r.ListUserSessions(userID); len(items) != 0 {
		t.Fatalf("revoked session still listed: %+v", items)
	}
}

func TestUserSessionRevokeOthersAndAll(t *testing.T) {
	r, err := Open(t.TempDir() + "/sessions-revoke.db")
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	expiry := time.Now().Add(time.Hour).Unix()
	for _, token := range []string{"current", "other"} {
		if _, err := r.EnsureUserSession(1, token, "127.0.0.1", "ua", expiry); err != nil {
			t.Fatal(err)
		}
	}

	if err := r.RevokeOtherUserSessions(1, "current"); err != nil {
		t.Fatal(err)
	}
	if valid, _ := r.EnsureUserSession(1, "other", "127.0.0.1", "ua", expiry); valid {
		t.Fatal("other session should be revoked")
	}
	if valid, _ := r.EnsureUserSession(1, "current", "127.0.0.1", "ua", expiry); !valid {
		t.Fatal("current session should remain valid")
	}

	if err := r.RevokeAllUserSessions(1); err != nil {
		t.Fatal(err)
	}
	if valid, _ := r.EnsureUserSession(1, "current", "127.0.0.1", "ua", expiry); valid {
		t.Fatal("all sessions should be revoked")
	}
}

func TestUserSessionRejectsExpiredToken(t *testing.T) {
	r, err := Open(t.TempDir() + "/sessions-expired.db")
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	valid, err := r.EnsureUserSession(1, "expired", "127.0.0.1", "ua", time.Now().Add(-time.Hour).Unix())
	if err != nil {
		t.Fatal(err)
	}
	if valid {
		t.Fatal("expired session was accepted")
	}
}
