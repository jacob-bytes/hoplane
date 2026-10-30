package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

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
	var action, username, auditedIP, auditedUA string
	var completedStatus, completedCode int
	handler := JWT(AuthOptions{
		JWTSecret: "unit-test-secret",
		GetUserAuthState: func(userID int64) (*auth.UserAuthState, error) {
			return &auth.UserAuthState{ID: userID, RoleID: 0, Status: 1}, nil
		},
		Audit: func(userID int64, user, auditedAction, method, path, ip, ua string, status int) int64 {
			calls++
			username = user
			action = auditedAction
			auditedIP = ip
			auditedUA = ua
			if status != 0 {
				t.Fatalf("expected pre-handler status 0, got %d", status)
			}

			return 42
		},
		AuditComplete: func(id int64, status, code int) {
			if id != 42 {
				t.Fatalf("completed wrong audit row: %d", id)
			}
			completedStatus = status
			completedCode = code
		},
	})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	post := func(path string) {
		req := httptest.NewRequest(http.MethodPost, path, nil)
		req.Header.Set("Authorization", token)
		req.Header.Set("User-Agent", "audit-test-agent")
		handler.ServeHTTP(httptest.NewRecorder(), req)
	}

	post("/api/v1/forward/create")
	if calls != 1 || action != "forward/create" || username != "admin_user" ||
		auditedIP == "" || auditedUA != "audit-test-agent" {
		t.Fatalf("unexpected audit: calls=%d action=%q user=%q ip=%q ua=%q",
			calls, action, username, auditedIP, auditedUA)
	}
	if completedStatus != http.StatusNoContent || completedCode != 0 {
		t.Fatalf("completed status/code = %d/%d", completedStatus, completedCode)
	}

	post("/api/v1/forward/list")
	post("/api/v1/federation/runtime/command")
	if calls != 1 {
		t.Fatalf("read/federation requests were audited: %d", calls)
	}
}

func TestLegacyTokenWithoutJTIStillWorks(t *testing.T) {
	const secret = "unit-test-secret"
	encode := func(value string) string {
		return base64.RawURLEncoding.EncodeToString([]byte(value))
	}
	now := time.Now()
	header := encode(`{"alg":"HmacSHA256","typ":"JWT"}`)
	payload := encode(`{"sub":"1","iat":` + jsonNumber(now.Unix()) + `,"iat_ms":` + jsonNumber(now.UnixMilli()) + `,"exp":` + jsonNumber(now.Add(time.Hour).Unix()) + `,"user":"admin_user","name":"admin_user","role_id":0}`)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(header + "." + payload))
	token := header + "." + payload + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	called := false
	handler := JWT(AuthOptions{
		JWTSecret: secret,
		GetUserAuthState: func(userID int64) (*auth.UserAuthState, error) {
			return &auth.UserAuthState{ID: userID, RoleID: 0, Status: 1}, nil
		},
		EnsureUserSession: func(int64, string, string, string, int64) (bool, error) {
			called = true

			return true, nil
		},
	})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/node/list", nil)
	req.Header.Set("Authorization", token)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusNoContent {
		t.Fatalf("legacy token status = %d", res.Code)
	}
	if called {
		t.Fatal("session lookup ran for a legacy token without jti")
	}
}

func jsonNumber(value int64) string {
	return strconv.FormatInt(value, 10)
}

func TestAuditCompleteCapturesAPICode(t *testing.T) {
	token := testToken(t)
	var gotStatus, gotCode int
	handler := JWT(AuthOptions{
		JWTSecret: "unit-test-secret",
		GetUserAuthState: func(userID int64) (*auth.UserAuthState, error) {
			return &auth.UserAuthState{ID: userID, RoleID: 0, Status: 1}, nil
		},
		Audit: func(int64, string, string, string, string, string, string, int) int64 {
			return 7
		},
		AuditComplete: func(id int64, status, code int) {
			if id != 7 {
				t.Fatalf("id = %d", id)
			}
			gotStatus = status
			gotCode = code
		},
	})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"code":-1,"msg":"转发不存在"}`))
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/forward/update", nil)
	req.Header.Set("Authorization", token)
	handler.ServeHTTP(httptest.NewRecorder(), req)
	if gotStatus != http.StatusOK || gotCode != -1 {
		t.Fatalf("status/code = %d/%d", gotStatus, gotCode)
	}
}
