package repo

import (
	"testing"
	"time"

	"go-backend/internal/store/model"
)

func TestAuditLogCreateAndList(t *testing.T) {
	r, err := Open(t.TempDir() + "/audit.db")
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	for _, action := range []string{"node/create", "forward/update"} {
		if err := r.CreateAuditLog(model.AuditLog{
			UserID: 1, Username: "admin", Action: action,
			Method: "POST", Path: "/api/v1/" + action, IP: "127.0.0.1",
		}); err != nil {
			t.Fatal(err)
		}
	}

	items, _, err := r.ListAuditLogs(10, 0)
	if err != nil {
		t.Fatalf("ListAuditLogs() error = %v", err)
	}
	if len(items) != 2 || items[0].Action != "forward/update" || items[1].Action != "node/create" {
		t.Fatalf("unexpected audit order: %+v", items)
	}
	if items[0].CreatedAt == 0 {
		t.Fatal("audit entry has no timestamp")
	}

	page, total, err := r.ListAuditLogs(2, 1)
	if err != nil {
		t.Fatal(err)
	}
	if total != 2 || len(page) != 1 || page[0].Action != "node/create" {
		t.Fatalf("pagination returned total=%d items=%+v", total, page)
	}
}

func TestPurgeAuditLogs(t *testing.T) {
	r, err := Open(t.TempDir() + "/audit-purge.db")
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	now := time.Now().UnixMilli()
	if err := r.CreateAuditLog(model.AuditLog{UserID: 1, Action: "old", CreatedAt: now - 100*24*3600_000}); err != nil {
		t.Fatal(err)
	}
	if err := r.CreateAuditLog(model.AuditLog{UserID: 1, Action: "new", CreatedAt: now}); err != nil {
		t.Fatal(err)
	}
	if err := r.PurgeAuditLogs(now - 90*24*3600_000); err != nil {
		t.Fatal(err)
	}
	items, total, _ := r.ListAuditLogs(10, 0)
	if total != 1 || len(items) != 1 || items[0].Action != "new" {
		t.Fatalf("purge left total=%d items=%+v", total, items)
	}
}

func TestAuditAndSessionTablesMigrate(t *testing.T) {
	r, err := Open(t.TempDir() + "/schema.db")
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	for _, table := range []string{"user_session", "audit_log"} {
		if !r.DB().Migrator().HasTable(table) {
			t.Fatalf("missing table %s", table)
		}
	}
}
