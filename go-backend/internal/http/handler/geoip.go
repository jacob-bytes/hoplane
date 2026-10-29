package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// lookupNodeCountry resolves an IP through an operator-supplied service.
// HOPLANE_GEOIP_URL is a template such as "http://geoip.local/{ip}" and may
// return either a two-letter code or {"country_code":"US"} / {"country":"US"}.
// It is deliberately opt-in: a self-hosted panel should not send node IPs to
// a third party unless the operator configures one.
func (h *Handler) lookupNodeCountry(ip string) string {
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
