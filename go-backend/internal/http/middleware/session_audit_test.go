package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"go-backend/internal/auth"
	"go-backend/internal/http/response"
)

func testToken(t *testing.T) string {
	t.Helper()
	token, err := auth.GenerateToken(1, "admin_user", 0, "unit-test-secret")
	if err != nil {
		t.Fatal(err)
	}

	return token
}

func TestSessionMiddlewareRejectsRevokedToken(t *testing.T) {
	token := testToken(t)
	revoked := false
	handler := JWT(AuthOptions{
		JWTSecret: "unit-test-secret",
		GetUserAuthState: func(userID int64) (*auth.UserAuthState, error) {
			return &auth.UserAuthState{ID: userID, RoleID: 0, Status: 1}, nil
		},
		EnsureUserSession: func(userID int64, tokenID, ip, ua string, expiresAt int64) (bool, error) {
			if tokenID == "" {
				t.Fatal("middleware did not pass a token id")
			}

			return !revoked, nil
		},
	})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/node/list", nil)
	req.Header.Set("Authorization", token)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusNoContent {
		t.Fatalf("valid session status = %d", res.Code)
	}

	revoked = true
	req = httptest.NewRequest(http.MethodPost, "/api/v1/node/list", nil)
	req.Header.Set("Authorization", token)
	res = httptest.NewRecorder()
	handler.ServeHTTP(res, req)

	var out response.R
	_ = json.NewDecoder(res.Body).Decode(&out)
	if out.Code != 401 {
		t.Fatalf("expected 401 for revoked session, got %+v", out)
	}
}

func TestAuditMiddlewareRecordsMutationsOnly(t *testing.T) {
	token := testToken(t)
	var calls int
	var action, username string
	handler := JWT(AuthOptions{
		JWTSecret: "unit-test-secret",
		GetUserAuthState: func(userID int64) (*auth.UserAuthState, error) {
			return &auth.UserAuthState{ID: userID, RoleID: 0, Status: 1}, nil
		},
		Audit: func(userID int64, user, auditedAction, method, path, ip, ua string, status int) {
			calls++
			username = user
			action = auditedAction
			if status != 0 {
				t.Fatalf("expected pre-handler status 0, got %d", status)
			}
		},
	})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	post := func(path string) {
		req := httptest.NewRequest(http.MethodPost, path, nil)
		req.Header.Set("Authorization", token)
		handler.ServeHTTP(httptest.NewRecorder(), req)
	}

	post("/api/v1/forward/create")
	if calls != 1 || action != "forward/create" || username != "admin_user" {
		t.Fatalf("unexpected audit: calls=%d action=%q user=%q", calls, action, username)
	}

	post("/api/v1/forward/list")
	post("/api/v1/federation/runtime/command")
	if calls != 1 {
		t.Fatalf("read/federation requests were audited: %d", calls)
	}
}
