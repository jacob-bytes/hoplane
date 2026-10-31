package repo

import (
	"errors"
	"testing"
	"time"

	"go-backend/internal/store/model"
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

func TestRevokeUserSessionIsScopedToUser(t *testing.T) {
	r, err := Open(t.TempDir() + "/sessions-scope.db")
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	expiry := time.Now().Add(time.Hour).Unix()
	if _, err := r.EnsureUserSession(1, "owner", "127.0.0.1", "ua", expiry); err != nil {
		t.Fatal(err)
	}
	if _, err := r.EnsureUserSession(2, "victim", "127.0.0.1", "ua", expiry); err != nil {
		t.Fatal(err)
	}

	items, _ := r.ListUserSessions(2)
	if len(items) != 1 {
		t.Fatalf("victim sessions = %d", len(items))
	}
	if err := r.RevokeUserSession(1, items[0].ID); err != nil {
		t.Fatal(err)
	}
	if valid, _ := r.EnsureUserSession(2, "victim", "127.0.0.1", "ua", expiry); !valid {
		t.Fatal("another user's session was revoked")
	}
}

func TestEnsureUserSessionRefreshesLastSeen(t *testing.T) {
	r, err := Open(t.TempDir() + "/sessions-seen.db")
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	expiry := time.Now().Add(time.Hour).Unix()
	if _, err := r.EnsureUserSession(1, "seen", "127.0.0.1", "ua", expiry); err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-10 * time.Minute).UnixMilli()
	if err := r.DB().Model(&model.UserSession{}).Where("token_id = ?", "seen").Update("last_seen_at", old).Error; err != nil {
		t.Fatal(err)
	}

	if _, err := r.EnsureUserSession(1, "seen", "127.0.0.1", "ua", expiry); err != nil {
		t.Fatal(err)
	}
	var seen int64
	if err := r.DB().Raw(`SELECT last_seen_at FROM user_session WHERE token_id = ?`, "seen").Row().Scan(&seen); err != nil {
		t.Fatal(err)
	}
	if seen <= old {
		t.Fatalf("last_seen_at was not refreshed: %d", seen)
	}
}

func TestPurgeUserSessions(t *testing.T) {
	r, err := Open(t.TempDir() + "/sessions-purge.db")
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	expiry := time.Now().Add(time.Hour).Unix()
	if _, err := r.EnsureUserSession(1, "purge", "127.0.0.1", "ua", expiry); err != nil {
		t.Fatal(err)
	}
	cutoff := time.Now().Add(-time.Hour).UnixMilli()
	if err := r.DB().Model(&model.UserSession{}).Where("token_id = ?", "purge").Update("revoked_at", cutoff-1).Error; err != nil {
		t.Fatal(err)
	}
	if err := r.PurgeUserSessions(cutoff); err != nil {
		t.Fatal(err)
	}
	if items, _ := r.ListUserSessions(1); len(items) != 0 {
		t.Fatalf("revoked session was not purged: %+v", items)
	}
}

func TestHasUserSessionIP(t *testing.T) {
	r, err := Open(t.TempDir() + "/sessions-ip.db")
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	expiry := time.Now().Add(time.Hour).Unix()
	if _, err := r.EnsureUserSession(1, "known", "203.0.113.9", "ua", expiry); err != nil {
		t.Fatal(err)
	}
	if known, err := r.HasUserSessionIP(1, "203.0.113.9"); err != nil || !known {
		t.Fatalf("known IP = %v, %v", known, err)
	}
	if known, err := r.HasUserSessionIP(1, "203.0.113.10"); err != nil || known {
		t.Fatalf("new IP = %v, %v", known, err)
	}
}

func TestEnsureUserSessionConcurrentFirstUse(t *testing.T) {
	r, err := Open(t.TempDir() + "/sessions-race.db")
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	expiry := time.Now().Add(time.Hour).Unix()
	errs := make(chan error, 8)
	for i := 0; i < 8; i++ {
		go func() {
			valid, err := r.EnsureUserSession(1, "race", "203.0.113.1", "ua", expiry)
			if err != nil {
				errs <- err

				return
			}
			if !valid {
				errs <- errors.New("concurrent session marked invalid")

				return
			}
			errs <- nil
		}()
	}
	for i := 0; i < 8; i++ {
		if err := <-errs; err != nil {
			t.Fatal(err)
		}
	}
	items, _ := r.ListUserSessions(1)
	if len(items) != 1 {
		t.Fatalf("sessions = %d", len(items))
	}
}
