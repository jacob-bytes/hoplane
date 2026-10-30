package repo

import (
	"testing"

	"go-backend/internal/store/model"
)

func TestNotifyLogCreateListAndGet(t *testing.T) {
	r, err := Open(t.TempDir() + "/notify-log.db")
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	if err := r.CreateNotifyLog(model.NotifyLog{Event: "test", Title: "测试", Message: "hello", Success: true}); err != nil {
		t.Fatal(err)
	}
	items, err := r.ListNotifyLogs(10)
	if err != nil || len(items) != 1 || items[0].Title != "测试" {
		t.Fatalf("list = %+v, %v", items, err)
	}
	got, err := r.GetNotifyLog(items[0].ID)
	if err != nil || got.Message != "hello" {
		t.Fatalf("get = %+v, %v", got, err)
	}
}
