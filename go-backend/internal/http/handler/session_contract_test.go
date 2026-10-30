package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"go-backend/internal/auth"
	"go-backend/internal/http/middleware"
	"go-backend/internal/http/response"
	"go-backend/internal/store/repo"
)

func TestSessionEndpointsListAndRevoke(t *testing.T) {
	r, err := repo.Open(t.TempDir() + "/session-api.db")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = r.Close() })
	h := New(r, "unit-test-secret")
	mux := http.NewServeMux()
	h.Register(mux)
	router := middleware.JWT(middleware.AuthOptions{
		JWTSecret:         "unit-test-secret",
		GetUserAuthState:  h.GetUserAuthState,
		EnsureUserSession: h.EnsureUserSession,
	})(mux)

	token1, err := auth.GenerateToken(1, "admin_user", 0, "unit-test-secret")
	if err != nil {
		t.Fatal(err)
	}
	token2, err := auth.GenerateToken(1, "admin_user", 0, "unit-test-secret")
	if err != nil {
		t.Fatal(err)
	}

	call := func(token, path string) (int, response.R) {
		req := httptest.NewRequest(http.MethodPost, path, bytes.NewBufferString("{}"))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", token)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		var out response.R
		_ = json.NewDecoder(rec.Body).Decode(&out)

		return rec.Code, out
	}
	list := func(token string) (int, []map[string]interface{}) {
		status, out := call(token, "/api/v1/user/session/list")
		raw, _ := json.Marshal(out.Data)
		var items []map[string]interface{}
		_ = json.Unmarshal(raw, &items)

		return status, items
	}

	if _, items := list(token1); len(items) != 1 {
		t.Fatalf("first token sessions = %d", len(items))
	}
	if _, items := list(token2); len(items) != 2 {
		t.Fatalf("second token sessions = %d", len(items))
	}
	if _, items := list(token1); len(items) != 2 {
		t.Fatalf("shared sessions = %d", len(items))
	}

	status, out := call(token1, "/api/v1/user/session/revoke-others")
	if status != http.StatusOK || out.Code != 0 {
		t.Fatalf("revoke-others status=%d body=%+v", status, out)
	}

	status, body := call(token2, "/api/v1/user/session/list")
	if status != http.StatusOK || body.Code != 401 {
		t.Fatalf("second token should be revoked: status=%d body=%+v", status, body)
	}
	if _, items := list(token1); len(items) != 1 {
		t.Fatalf("current token sessions = %d", len(items))
	}

	if _, out := call(token1, "/api/v1/user/session/revoke-all"); out.Code != 0 {
		t.Fatalf("revoke-all body=%+v", out)
	}
	status, body = call(token1, "/api/v1/user/session/list")
	if status != http.StatusOK || body.Code != 401 {
		t.Fatalf("current token should be revoked after revoke-all: %+v", body)
	}
}

func TestAuditListEndpoint(t *testing.T) {
	r, err := repo.Open(t.TempDir() + "/audit-api.db")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = r.Close() })
	h := New(r, "unit-test-secret")
	mux := http.NewServeMux()
	h.Register(mux)
	router := middleware.JWT(middleware.AuthOptions{
		JWTSecret:        "unit-test-secret",
		GetUserAuthState: h.GetUserAuthState,
	})(mux)

	h.RecordAudit(1, "admin_user", "node/create", "POST", "/api/v1/node/create", "127.0.0.1", "ua", 0)

	token, err := auth.GenerateToken(1, "admin_user", 0, "unit-test-secret")
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/audit/list", bytes.NewBufferString("{}"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	var out response.R
	_ = json.NewDecoder(rec.Body).Decode(&out)
	if out.Code != 0 {
		t.Fatalf("audit list failed: %+v", out)
	}
	raw, _ := json.Marshal(out.Data)
	var items []map[string]interface{}
	_ = json.Unmarshal(raw, &items)
	if len(items) != 1 || items[0]["action"] != "node/create" {
		t.Fatalf("unexpected audit list: %s", raw)
	}
}
