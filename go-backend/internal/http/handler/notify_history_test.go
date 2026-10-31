package handler

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"go-backend/internal/store/repo"
)

func TestNotifyFailureIsRecorded(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "down", http.StatusBadGateway)
	}))
	defer server.Close()

	r, err := repo.Open(filepath.Join(t.TempDir(), "notify-history.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = r.Close() })
	for key, value := range map[string]string{
		"notify_enabled":     "true",
		"notify_webhook_url": server.URL,
		"notify_events":      "",
	} {
		if err := r.UpsertConfig(key, value, 1); err != nil {
			t.Fatal(err)
		}
	}

	h := New(r, "secret")
	h.notify("test", "webhook failure", "body")

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		logs, err := r.ListNotifyLogs(5)
		if err == nil && len(logs) == 1 {
			if logs[0].Success || logs[0].Error == "" {
				t.Fatalf("failure was not recorded: %+v", logs[0])
			}

			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("notification history was not written")
}
