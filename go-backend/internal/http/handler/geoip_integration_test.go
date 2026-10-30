package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"go-backend/internal/auth"
	"go-backend/internal/http/middleware"
	"go-backend/internal/store/repo"
)

func TestNodeCreateUsesGeoIPOnlyWhenCountryEmpty(t *testing.T) {
	r, err := repo.Open(t.TempDir() + "/geo-node.db")
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

	resetGeoCache()
	t.Setenv("HOPLANE_GEOIP_MMDB", filepath.Join("testdata", "GeoIP2-Country-Test.mmdb"))
	t.Setenv("HOPLANE_GEOIP_CSV", "")
	t.Setenv("HOPLANE_GEOIP_URL", "")

	token, _ := auth.GenerateToken(1, "admin_user", 0, "unit-test-secret")
	create := func(name, country string) {
		body, _ := json.Marshal(map[string]interface{}{
			"name": name, "serverIp": "2.125.160.216", "port": "1000-2000",
			"forwardMode": "agent", "country": country,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/node/create", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", token)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		var out struct {
			Code int `json:"code"`
		}
		_ = json.NewDecoder(rec.Body).Decode(&out)
		if out.Code != 0 {
			t.Fatalf("create %s failed: %s", name, rec.Body.String())
		}
	}

	create("geo-auto", "")
	create("geo-manual", "CN")

	var auto, manual string
	if err := r.DB().Raw(`SELECT country FROM node WHERE name = ?`, "geo-auto").Row().Scan(&auto); err != nil {
		t.Fatal(err)
	}
	if err := r.DB().Raw(`SELECT country FROM node WHERE name = ?`, "geo-manual").Row().Scan(&manual); err != nil {
		t.Fatal(err)
	}
	if auto != "GB" {
		t.Fatalf("auto country = %q", auto)
	}
	if manual != "CN" {
		t.Fatalf("manual country was overwritten: %q", manual)
	}
}
