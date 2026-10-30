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
	path := filepath.Join("testdata", "GeoIP2-Country-Test.mmdb")
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("test MMDB missing: %v", err)
	}

	geoMMDBOnce = sync.Once{}
	geoMMDB = nil
	t.Setenv("HOPLANE_GEOIP_MMDB", path)
	t.Setenv("HOPLANE_GEOIP_CSV", "")
	t.Setenv("HOPLANE_GEOIP_URL", "")

	if got := (&Handler{}).lookupNodeCountry("2.125.160.216"); got != "GB" {
		t.Fatalf("expected GB from MMDB, got %q", got)
	}
}

func resetGeoCache() {
	geoMMDBOnce = sync.Once{}
	geoMMDB = nil
	geoCSVOnce = sync.Once{}
	geoCSVEntries = nil
}

func TestGeoIPPrecedenceAndIPv6(t *testing.T) {
	mmdb := filepath.Join("testdata", "GeoIP2-Country-Test.mmdb")
	csvPath := filepath.Join(t.TempDir(), "geo.csv")
	if err := os.WriteFile(csvPath, []byte("cidr,country\n2.125.160.0/24,CN\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	resetGeoCache()
	t.Setenv("HOPLANE_GEOIP_MMDB", mmdb)
	t.Setenv("HOPLANE_GEOIP_CSV", csvPath)
	t.Setenv("HOPLANE_GEOIP_URL", "")

	h := &Handler{}
	if got := h.lookupNodeCountry("2.125.160.216"); got != "GB" {
		t.Fatalf("MMDB should win over CSV, got %q", got)
	}
	if got := h.lookupNodeCountry("2001:218::1"); got != "JP" {
		t.Fatalf("IPv6 lookup = %q", got)
	}
	if got := h.lookupNodeCountry("10.0.0.1"); got != "" {
		t.Fatalf("private IP should have no country, got %q", got)
	}

	resetGeoCache()
	t.Setenv("HOPLANE_GEOIP_MMDB", filepath.Join(t.TempDir(), "missing.mmdb"))
	if got := h.lookupNodeCountry("2.125.160.216"); got != "CN" {
		t.Fatalf("CSV fallback = %q", got)
	}
}
