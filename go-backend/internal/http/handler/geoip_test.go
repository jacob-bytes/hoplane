package handler

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func TestLookupNodeCountryFromOfflineCSV(t *testing.T) {
	path := filepath.Join(t.TempDir(), "geo.csv")
	if err := os.WriteFile(path, []byte("cidr,country\n203.0.113.0/24,US\n198.51.100.0/24,JP\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	t.Setenv("HOPLANE_GEOIP_CSV", path)
	t.Setenv("HOPLANE_GEOIP_URL", "")
	h := &Handler{}

	if got := h.lookupNodeCountry("203.0.113.42"); got != "US" {
		t.Fatalf("expected US, got %q", got)
	}
	if got := h.lookupNodeCountry("198.51.100.7"); got != "JP" {
		t.Fatalf("expected JP, got %q", got)
	}
	if got := h.lookupNodeCountry("192.0.2.1"); got != "" {
		t.Fatalf("expected no match, got %q", got)
	}
}

func TestLookupNodeCountryFromMMDB(t *testing.T) {
	path := os.Getenv("HOPLANE_TEST_GEOIP_MMDB")
	if path == "" {
		t.Skip("HOPLANE_TEST_GEOIP_MMDB not set")
	}

	geoMMDBOnce = sync.Once{}
	geoMMDB = nil
	t.Setenv("HOPLANE_GEOIP_MMDB", path)
	t.Setenv("HOPLANE_GEOIP_CSV", "")
	t.Setenv("HOPLANE_GEOIP_URL", "")

	if got := (&Handler{}).lookupNodeCountry("8.8.8.8"); got != "US" {
		t.Fatalf("expected US from MMDB, got %q", got)
	}
}
