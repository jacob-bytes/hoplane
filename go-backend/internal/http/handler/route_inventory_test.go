package handler

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"go-backend/internal/auth"
	"go-backend/internal/http/middleware"
	"go-backend/internal/store/repo"
)

func TestCriticalFrontendRoutesAreRegistered(t *testing.T) {
	r, err := repo.Open(t.TempDir() + "/routes.db")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = r.Close() })
	h := New(r, "route-secret")
	mux := http.NewServeMux()
	h.Register(mux)
	router := middleware.JWT(middleware.AuthOptions{
		JWTSecret:         "route-secret",
		GetUserAuthState:  h.GetUserAuthState,
		EnsureUserSession: h.EnsureUserSession,
	})(mux)

	token, _ := auth.GenerateToken(1, "admin_user", 0, "route-secret")
	routes := []string{
		"/api/v1/user/session/list",
		"/api/v1/user/session/revoke",
		"/api/v1/user/session/revoke-others",
		"/api/v1/user/session/revoke-all",
		"/api/v1/audit/list",
		"/api/v1/notify/logs/list",
		"/api/v1/notify/logs/resend",
		"/api/v1/user/package",
		"/api/v1/node/list",
		"/api/v1/subscription/list",
		"/api/v1/forward/list",
	}
	for _, path := range routes {
		req := httptest.NewRequest(http.MethodPost, path, bytes.NewBufferString("{}"))
		req.Header.Set("Authorization", token)
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code == http.StatusNotFound {
			t.Errorf("%s is not registered", path)
		}
	}
}
