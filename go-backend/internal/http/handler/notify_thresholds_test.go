package handler

import (
	"path/filepath"
	"testing"

	"go-backend/internal/store/repo"
)

func TestNotifyThresholdsReadConfig(t *testing.T) {
	r, err := repo.Open(filepath.Join(t.TempDir(), "notify-thresholds.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = r.Close() })
	h := New(r, "secret")

	ratio, days := h.notifyThresholds()
	if ratio != 0.9 || days != 3 {
		t.Fatalf("defaults = %v/%d", ratio, days)
	}
	if err := r.UpsertConfig("notify_flow_warn_ratio", "80", 1); err != nil {
		t.Fatal(err)
	}
	if err := r.UpsertConfig("notify_expiry_days", "7", 1); err != nil {
		t.Fatal(err)
	}
	ratio, days = h.notifyThresholds()
	if ratio != 0.8 || days != 7 {
		t.Fatalf("configured = %v/%d", ratio, days)
	}
}
