package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

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
	h.RecordAudit(1, "admin_user", "forward/update", "POST", "/api/v1/forward/update", "127.0.0.1", "ua", 0)
	h.RecordAudit(1, "admin_user", "user/update", "POST", "/api/v1/user/update", "127.0.0.1", "ua", 0)

	token, err := auth.GenerateToken(1, "admin_user", 0, "unit-test-secret")
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/audit/list", bytes.NewBufferString(`{"page":2,"pageSize":2}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	var out response.R
	_ = json.NewDecoder(rec.Body).Decode(&out)
	if out.Code != 0 {
		t.Fatalf("audit list failed: %+v", out)
	}
	data, _ := out.Data.(map[string]interface{})
	raw, _ := json.Marshal(data["items"])
	var items []map[string]interface{}
	_ = json.Unmarshal(raw, &items)
	if len(items) != 1 || items[0]["action"] != "node/create" {
		t.Fatalf("unexpected audit page: %s", raw)
	}
	if total, _ := data["total"].(float64); total != 3 {
		t.Fatalf("total = %v", data["total"])
	}
	if page, _ := data["page"].(float64); page != 2 {
		t.Fatalf("page = %v", data["page"])
	}
}

func TestSessionRevokeSingleDevice(t *testing.T) {
	r, err := repo.Open(t.TempDir() + "/session-revoke-one.db")
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

	token1, _ := auth.GenerateToken(1, "admin_user", 0, "unit-test-secret")
	token2, _ := auth.GenerateToken(1, "admin_user", 0, "unit-test-secret")
	call := func(token, path, body string) response.R {
		req := httptest.NewRequest(http.MethodPost, path, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", token)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		var out response.R
		_ = json.NewDecoder(rec.Body).Decode(&out)

		return out
	}

	out := call(token1, "/api/v1/user/session/list", "{}")
	_ = call(token2, "/api/v1/user/session/list", "{}")
	out = call(token1, "/api/v1/user/session/list", "{}")
	raw, _ := json.Marshal(out.Data)
	var items []map[string]interface{}
	_ = json.Unmarshal(raw, &items)
	if len(items) != 2 {
		t.Fatalf("sessions = %d", len(items))
	}

	var otherID float64
	for _, item := range items {
		if item["current"] != true {
			otherID, _ = item["id"].(float64)
		}
	}
	if otherID == 0 {
		t.Fatal("other session id not found")
	}

	body, _ := json.Marshal(map[string]interface{}{"id": int64(otherID)})
	if out := call(token1, "/api/v1/user/session/revoke", string(body)); out.Code != 0 {
		t.Fatalf("revoke failed: %+v", out)
	}
	if out := call(token2, "/api/v1/user/session/list", "{}"); out.Code != 401 {
		t.Fatalf("revoked token still accepted: %+v", out)
	}
}

func TestAuditListRequiresAdmin(t *testing.T) {
	r, err := repo.Open(t.TempDir() + "/audit-role.db")
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

	if _, err := r.CreateUser("normal_user", "pwd", 1, 2727251700000, 100, 0, 10, 1, 0, 1); err != nil {
		t.Fatal(err)
	}
	token, _ := auth.GenerateToken(2, "normal_user", 1, "unit-test-secret")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/audit/list", bytes.NewBufferString(`{"page":2,"pageSize":2}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	var out response.R
	_ = json.NewDecoder(rec.Body).Decode(&out)
	if out.Code != 403 {
		t.Fatalf("expected 403, got %+v", out)
	}
}

func TestUserPackageReturnsDirectionalStatistics(t *testing.T) {
	r, err := repo.Open(t.TempDir() + "/package-stats.db")
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

	userID, err := r.CreateUser("pkg_user", "pwd", 1, 2727251700000, 1000, 0, 10, 1, 0, 1)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UnixMilli()
	if err := r.CreateStatisticsFlow(userID, 300, 100, 200, 300, "10:00", now); err != nil {
		t.Fatal(err)
	}
	if err := r.CreateStatisticsFlow(userID, 500, 200, 300, 800, "11:00", now+3600_000); err != nil {
		t.Fatal(err)
	}

	token, _ := auth.GenerateToken(userID, "pkg_user", 1, "unit-test-secret")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/user/package", bytes.NewBufferString("{}"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	var out response.R
	_ = json.NewDecoder(rec.Body).Decode(&out)
	if out.Code != 0 {
		t.Fatalf("user package failed: %+v", out)
	}
	data, _ := out.Data.(map[string]interface{})
	raw, _ := json.Marshal(data["statisticsFlows"])
	var rows []map[string]interface{}
	_ = json.Unmarshal(raw, &rows)
	if len(rows) != 2 {
		t.Fatalf("statistics rows = %d", len(rows))
	}
	if rows[0]["inFlow"].(float64) != 100 || rows[0]["outFlow"].(float64) != 200 {
		t.Fatalf("missing direction fields: %+v", rows[0])
	}
	if rows[0]["createdTime"].(float64) != float64(now) {
		t.Fatalf("missing createdTime: %+v", rows[0])
	}
}
