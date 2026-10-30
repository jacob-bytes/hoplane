package handler

import (
	"encoding/csv"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/oschwald/maxminddb-golang"
)

type geoMMDBRecord struct {
	Country struct {
		ISOCode string `maxminddb:"iso_code"`
	} `maxminddb:"country"`
}

var (
	geoMMDBOnce sync.Once
	geoMMDB     *maxminddb.Reader
)

func loadGeoMMDB() {
	paths := []string{strings.TrimSpace(os.Getenv("HOPLANE_GEOIP_MMDB"))}
	paths = append(paths,
		"/usr/share/hoplane/GeoLite2-Country.mmdb",
		"/app/GeoLite2-Country.mmdb",
		"GeoLite2-Country.mmdb",
	)

	for _, path := range paths {
		if path == "" {
			continue
		}
		if _, err := os.Stat(path); err != nil {
			continue
		}
		reader, err := maxminddb.Open(path)
		if err == nil {
			geoMMDB = reader

			return
		}
	}
}

func lookupGeoMMDB(ip string) string {
	geoMMDBOnce.Do(loadGeoMMDB)
	if geoMMDB == nil {
		return ""
	}
	addr, err := netip.ParseAddr(strings.TrimSpace(ip))
	if err != nil {
		return ""
	}
	var record geoMMDBRecord
	if err := geoMMDB.Lookup(net.IP(addr.AsSlice()), &record); err != nil {
		return ""
	}
	code := strings.ToUpper(strings.TrimSpace(record.Country.ISOCode))
	if len(code) != 2 {
		return ""
	}

	return code
}

type geoCSVEntry struct {
	prefix netip.Prefix
	code   string
}

var (
	geoCSVOnce    sync.Once
	geoCSVEntries []geoCSVEntry
)

func loadGeoCSV() {
	path := strings.TrimSpace(os.Getenv("HOPLANE_GEOIP_CSV"))
	if path == "" {
		return
	}
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.FieldsPerRecord = -1
	records, err := reader.ReadAll()
	if err != nil {
		return
	}
	entries := make([]geoCSVEntry, 0, len(records))
	for _, record := range records {
		if len(record) < 2 {
			continue
		}
		prefix, err := netip.ParsePrefix(strings.TrimSpace(record[0]))
		if err != nil {
			continue
		}
		code := strings.ToUpper(strings.TrimSpace(record[1]))
		if len(code) != 2 {
			continue
		}
		entries = append(entries, geoCSVEntry{prefix: prefix, code: code})
	}
	geoCSVEntries = entries
}

func lookupGeoCSV(ip string) string {
	geoCSVOnce.Do(loadGeoCSV)
	addr, err := netip.ParseAddr(strings.TrimSpace(ip))
	if err != nil {
		return ""
	}
	for _, entry := range geoCSVEntries {
		if entry.prefix.Contains(addr) {
			return entry.code
		}
	}

	return ""
}

// lookupNodeCountry resolves an IP through an operator-supplied service.
// HOPLANE_GEOIP_URL is a template such as "http://geoip.local/{ip}" and may
// return either a two-letter code or {"country_code":"US"} / {"country":"US"}.
// It is deliberately opt-in: a self-hosted panel should not send node IPs to
// a third party unless the operator configures one.
func (h *Handler) lookupNodeCountry(ip string) string {
	if code := lookupGeoMMDB(ip); code != "" {
		return code
	}
	if code := lookupGeoCSV(ip); code != "" {
		return code
	}

	template := strings.TrimSpace(os.Getenv("HOPLANE_GEOIP_URL"))
	if template == "" || strings.TrimSpace(ip) == "" {
		return ""
	}

	endpoint := strings.ReplaceAll(template, "{ip}", url.QueryEscape(strings.TrimSpace(ip)))
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(endpoint)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ""
	}

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return ""
	}

	text := strings.TrimSpace(string(raw))
	if strings.HasPrefix(text, "{") {
		var payload map[string]interface{}
		if json.Unmarshal(raw, &payload) == nil {
			for _, key := range []string{"country_code", "countryCode", "country"} {
				if value, ok := payload[key].(string); ok && len(value) == 2 {
					return strings.ToUpper(value)
				}
			}
		}

		return ""
	}
	if len(text) == 2 {
		return strings.ToUpper(text)
	}

	return ""
}
